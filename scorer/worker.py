"""Scores stories for users. Runs continuously as a Vercel Daemon, pulling work from two queues:

- new-stories:  a story was just ingested, so read the article and score it for every user
- rescore-user: a user changed their interests, so score recent stories for them
"""

import asyncio
import json
import os
import signal
from functools import lru_cache
from pathlib import Path

import httpx
import numpy as np
import psycopg
import trafilatura
from fastembed import TextEmbedding
from openai import AsyncOpenAI
from psycopg.rows import dict_row
from vercel.queue import ALL_DEPLOYMENTS, QueueClient, subscribe

# A cheap local embedding model filters stories before any LLM call. Only stories whose headline
# and opening are at least this similar to one of a user's interests get scored.
RELEVANCE_THRESHOLD = 0.6
LLM = "anthropic/claude-haiku-5.5"
ARTICLE_CHARS = 6000  # enough to judge a story; keeps prompts small
USER_AGENT = "Mozilla/5.0 (compatible; Signal/1.0)"

embedder = TextEmbedding("BAAI/bge-small-en-v1.5")  # downloaded into the image at build time

SCORE_SCHEMA = {
    "type": "object",
    "properties": {
        "score": {"type": "integer"},
        "why": {"type": "string"},
    },
    "required": ["score", "why"],
    "additionalProperties": False,
}

PROMPT = """You help a reader decide which tech news is worth their time.
Their interests: {interests}
Headline: {title} ({source})
Article (may be cut short): {text}

Rate from 0 to 100 how much this story matters to them. Then explain why in one short
sentence, speaking to them as "you". Use only what the article says; don't invent details."""


@lru_cache(maxsize=10_000)
def embed(text: str) -> np.ndarray:
    vector = next(embedder.embed([text]))
    return vector / np.linalg.norm(vector)


def is_relevant(story: dict, interests: list[str]) -> bool:
    document = embed(f"{story['title']}. {story['text'][:500]}")
    return max(float(document @ embed(interest)) for interest in interests) >= RELEVANCE_THRESHOLD


async def read_article(url: str) -> str:
    """Returns the article's main text, or "" when the site blocks readers or has nothing to extract."""
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True, headers={"user-agent": USER_AGENT}) as client:
            response = await client.get(url)
            response.raise_for_status()
    except httpx.HTTPError:
        return ""
    return (trafilatura.extract(response.text) or "")[:ARTICLE_CHARS]


async def judge(story: dict, interests: list[str]) -> dict:
    # Daemons receive a fresh OIDC token in this file every few minutes, so read it per call.
    token = Path(os.environ["VERCEL_OIDC_TOKEN_FILE"]).read_text().strip()
    client = AsyncOpenAI(api_key=token, base_url="https://ai-gateway.vercel.sh/v1")
    response = await client.chat.completions.create(
        model=LLM,
        messages=[{"role": "user", "content": PROMPT.format(interests=", ".join(interests), **story)}],
        response_format={"type": "json_schema", "json_schema": {"name": "score", "schema": SCORE_SCHEMA}},
    )
    return json.loads(response.choices[0].message.content)


async def score_stories(conn: psycopg.AsyncConnection, user: dict, stories: list[dict]) -> None:
    relevant = [story for story in stories if is_relevant(story, user["interests"])]
    results = await asyncio.gather(*(judge(story, user["interests"]) for story in relevant))
    for story, result in zip(relevant, results):
        await conn.execute(
            """
            insert into user_story_scores (user_id, story_id, score, why) values (%s, %s, %s, %s)
            on conflict (user_id, story_id) do update set score = excluded.score, why = excluded.why
            """,
            (user["id"], story["id"], result["score"], result["why"]),
        )
        print(f"[scorer] {result['score']:>3}  {story['title']}")


def connect():
    # autocommit, so each score shows up in the feed as soon as it's written
    return psycopg.AsyncConnection.connect(os.environ["DATABASE_URL"], autocommit=True, row_factory=dict_row)


async def fetch_all(conn: psycopg.AsyncConnection, query: str, *params) -> list[dict]:
    cursor = await conn.execute(query, params)
    return await cursor.fetchall()


@subscribe(topic="new-stories", consumer_group="scorer")
async def on_new_story(message: dict) -> None:
    async with await connect() as conn:
        [story] = await fetch_all(
            conn, "select id, url, title, source, text from stories where id = %s", message["story_id"]
        )
        # Read the article once and keep it, so every user's score (and any rescore) reuses it.
        # If the site blocks us, the feed's excerpt saved at ingest stays in place.
        if article := await read_article(story["url"]):
            await conn.execute("update stories set text = %s where id = %s", (article, story["id"]))
            story["text"] = article

        users = await fetch_all(conn, "select id, interests from users where interests <> '{}'")
        for user in users:
            await score_stories(conn, user, [story])


@subscribe(topic="rescore-user", consumer_group="scorer")
async def on_rescore_user(message: dict) -> None:
    async with await connect() as conn:
        [user] = await fetch_all(conn, "select id, interests from users where id = %s", message["user_id"])
        stories = await fetch_all(
            conn, "select id, title, source, text from stories where published_at > now() - interval '3 days'"
        )
        await score_stories(conn, user, stories)


async def main() -> None:
    # Same region the api service sends to. ALL_DEPLOYMENTS keeps work flowing across redeploys.
    queue = QueueClient(region="iad1", deployment=ALL_DEPLOYMENTS)
    pollers = [asyncio.create_task(queue.poll_and_handle(h)) for h in (on_new_story, on_rescore_user)]
    print("[scorer] polling for work")

    stop = asyncio.Event()
    asyncio.get_running_loop().add_signal_handler(signal.SIGTERM, stop.set)
    await stop.wait()

    # A message interrupted here was never acknowledged, so the queue redelivers it.
    for poller in pollers:
        poller.cancel()


if __name__ == "__main__":
    asyncio.run(main())
