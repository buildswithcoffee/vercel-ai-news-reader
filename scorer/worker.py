"""Signal's scorer. Runs continuously as a Vercel Daemon:

- Every 15 minutes it scans the news sources, reads each new article, and scores it.
- When you change your interests, the web app queues a "rescore" and it rescores recent articles.
"""

import asyncio
import json
import os
import signal
from functools import lru_cache
from pathlib import Path

import numpy as np
import psycopg
from fastembed import TextEmbedding
from openai import AsyncOpenAI
from psycopg.rows import dict_row
from vercel.queue import ALL_DEPLOYMENTS, QueueClient, subscribe

from articles import read_article
from sources import fetch_stories

SCAN_EVERY_SECONDS = 15 * 60
RESCORE_BATCH_SIZE = 100
LLM_CONCURRENCY = 4
llm_slots = asyncio.Semaphore(LLM_CONCURRENCY)
# A cheap local embedding model filters articles before any LLM call. Only articles whose headline
# and opening are at least this similar to one of your interests get scored.
RELEVANCE_THRESHOLD = 0.6
LLM = "anthropic/claude-haiku-5.5"

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
What they care about, in their words: {about}
Topics they follow: {topics}
Headline: {title} ({source})
Article (may be cut short): {text}

Rate from 0 to 100 how much this story matters to them. Then explain why in one short
sentence, speaking to them as "you". Use only what the article says; don't invent details."""


@lru_cache(maxsize=10_000)
def embed(text: str) -> np.ndarray:
    vector = next(embedder.embed([text]))
    return vector / np.linalg.norm(vector)


def is_relevant(article: dict, interests: list[str]) -> bool:
    document = embed(f"{article['title']}. {article['text'][:500]}")
    return max(float(document @ embed(interest)) for interest in interests) >= RELEVANCE_THRESHOLD


async def judge(article: dict, profile: dict) -> dict:
    # Daemons receive a fresh OIDC token in this file every few minutes, so read it per call.
    token = Path(os.environ["VERCEL_OIDC_TOKEN_FILE"]).read_text().strip()
    client = AsyncOpenAI(api_key=token, base_url="https://ai-gateway.vercel.sh/v1", max_retries=0, timeout=30)
    response = await client.chat.completions.create(
        model=LLM,
        max_tokens=256,
        messages=[{
            "role": "user",
            "content": PROMPT.format(about=profile["about"], topics=", ".join(profile["topics"]) or "none", **article),
        }],
        response_format={"type": "json_schema", "json_schema": {"name": "score", "schema": SCORE_SCHEMA}},
    )
    choice = response.choices[0]
    if choice.finish_reason == "length":
        raise ValueError("the answer was cut off at max_tokens")
    return json.loads(choice.message.content)


def connect():
    # autocommit, so each score shows up in the feed as soon as it's written
    return psycopg.AsyncConnection.connect(os.environ["DATABASE_URL"], autocommit=True, row_factory=dict_row)


async def fetch_all(conn: psycopg.AsyncConnection, query: str, *params) -> list[dict]:
    cursor = await conn.execute(query, params)
    return await cursor.fetchall()


async def score(conn: psycopg.AsyncConnection, articles: list[dict], profile: dict | None = None) -> None:
    if profile is None:
        profile = next(iter(await fetch_all(conn, "select about, topics from profile")), None)
    if not profile:
        return  # nothing to score against until you say what you care about

    interests = [profile["about"], *profile["topics"]]
    relevant = [article for article in articles if is_relevant(article, interests)]
    print(f"[scorer] {len(relevant)} of {len(articles)} articles look relevant; asking the LLM to score them")
    async def score_one(article: dict) -> None:
        # Shared with scheduled scans, so simultaneous scan/rescore tasks also stay bounded.
        async with llm_slots:
            try:
                result = await judge(article, profile)
            except Exception as error:  # one bad answer shouldn't stop the rest of the batch
                print(f"[scorer] couldn't score {article['title']}: {error!r}")
                return
        await conn.execute(
            """
            insert into scores (article_id, score, why) values (%s, %s, %s)
            on conflict (article_id) do update set score = excluded.score, why = excluded.why
            """,
            (article["id"], result["score"], result["why"]),
        )
        print(f"[scorer] {result['score']:>3}  {article['title']}")

    # Bound task creation as well as in-flight requests.
    for offset in range(0, len(relevant), LLM_CONCURRENCY):
        await asyncio.gather(*(score_one(article) for article in relevant[offset:offset + LLM_CONCURRENCY]))


async def scan() -> None:
    async with await connect() as conn:
        stories = await fetch_stories(await fetch_all(conn, "select name, url from feeds where enabled"))
        new = []
        for story in stories:
            # Inserting claims the article, so even with several daemon instances each one is read once.
            new += await fetch_all(
                conn,
                """
                insert into articles (id, url, title, source, published_at, text)
                values (%s, %s, %s, %s, %s, %s)
                on conflict do nothing
                returning id, url, title, source, text
                """,
                story.id, story.url, story.title, story.source, story.published_at, story.text,
            )

        pages = await asyncio.gather(*(read_article(article["url"]) for article in new))
        for article, page in zip(new, pages):
            if page:  # otherwise keep the feed's excerpt
                await conn.execute(
                    "update articles set text = %s, image = %s, description = %s, author = %s where id = %s",
                    (page["text"], page["image"], page["description"], page["author"], article["id"]),
                )
                article["text"] = page["text"]

        print(f"[scorer] scanned {len(stories)} stories, {len(new)} new")
        if new:
            await score(conn, new)


@subscribe(topic="rescore", consumer_group="scorer")
async def on_rescore(message: dict[str, str]) -> None:
    await rescore_pending()


async def rescore_pending() -> None:
    async with await connect() as conn:
        # Treat queue messages only as hints. Claim the current DATABASE profile
        # atomically, regardless of the sender's deployment or message contents.
        # Persist before paid work: retries/restarts must not spend twice for a version.
        claimed = await fetch_all(conn, """
            update rescore_state as state
            set version = profile.version, started_at = now()
            from profile
            where state.id = true and profile.id = true
              and state.version < profile.version
              and (state.started_at is null or state.started_at <= now() - interval '15 minutes')
            returning profile.about, profile.topics
        """)
        if not claimed:
            return
        print("[scorer] admitted a changed profile; rescoring recent articles")
        articles = await fetch_all(
            conn,
            """select id, title, source, text from articles
               where published_at > now() - interval '3 days'
                 and source in (select name from feeds where enabled)
               order by published_at desc, id limit %s""",
            RESCORE_BATCH_SIZE,
        )
        await score(conn, articles, claimed[0])


async def scan_until(stop: asyncio.Event) -> None:
    while not stop.is_set():
        try:
            # Recover missed sends and changes deferred by the durable worker cooldown.
            await rescore_pending()
            await scan()
        except Exception as error:  # a source or the network failed; try again next round
            print(f"[scorer] scan failed: {error!r}")
        try:
            await asyncio.wait_for(stop.wait(), timeout=SCAN_EVERY_SECONDS)
        except TimeoutError:
            pass


async def main() -> None:
    # Same region the api service sends to. ALL_DEPLOYMENTS keeps work flowing across redeploys.
    queue = QueueClient(region="iad1", deployment=ALL_DEPLOYMENTS)
    stop = asyncio.Event()
    asyncio.get_running_loop().add_signal_handler(signal.SIGTERM, stop.set)

    # One task group: if the queue poller fails, the daemon exits with the error in its logs
    # and Vercel restarts it, instead of the poller dying silently while scans carry on.
    async with asyncio.TaskGroup() as tasks:
        poller = tasks.create_task(queue.poll_and_handle(on_rescore))
        await scan_until(stop)
        # A rescore interrupted here was never acknowledged, so the queue redelivers it.
        poller.cancel()


if __name__ == "__main__":
    asyncio.run(main())
