"""Signal's scorer. Runs continuously as a Vercel Daemon:

- Every 15 minutes it scans the news sources, reads each new article, and scores it.
- When you change your interests, the web app queues a "rescore" and it rescores recent articles.
"""

import asyncio
import ipaddress
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

from sources import fetch_stories

SCAN_EVERY_SECONDS = 15 * 60
# A cheap local embedding model filters articles before any LLM call. Only articles whose headline
# and opening are at least this similar to one of your interests get scored.
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


async def public_only(request: httpx.Request) -> None:
    """Runs before every request, including each redirect. Links come from the open web, so refuse any
    that point at a private address; otherwise a link could make the scorer read an internal page."""
    try:
        addresses = await asyncio.get_running_loop().getaddrinfo(request.url.host, request.url.port or 443)
    except OSError as error:  # the host doesn't resolve; skip this article like any other failed read
        raise httpx.ConnectError(f"can't resolve {request.url.host}", request=request) from error
    if not all(ipaddress.ip_address(address[4][0]).is_global for address in addresses):
        raise httpx.RequestError(f"refusing to read a private address: {request.url.host}", request=request)


async def read_article(url: str) -> dict | None:
    """Returns the article's text, lead photo, description, and author, or None when the site blocks readers."""
    try:
        async with httpx.AsyncClient(
            timeout=10, follow_redirects=True, headers={"user-agent": USER_AGENT}, event_hooks={"request": [public_only]}
        ) as client:
            response = await client.get(url)
            response.raise_for_status()
    except httpx.HTTPError:
        return None
    page = trafilatura.bare_extraction(response.text, with_metadata=True)
    if not page or not page.text:
        return None
    return {
        "text": page.text[:ARTICLE_CHARS],
        "image": page.image if (page.image or "").startswith("https://") else None,  # the feed is served over HTTPS
        "description": page.description,
        "author": page.author,
    }


async def judge(article: dict, profile: dict) -> dict:
    # Daemons receive a fresh OIDC token in this file every few minutes, so read it per call.
    token = Path(os.environ["VERCEL_OIDC_TOKEN_FILE"]).read_text().strip()
    client = AsyncOpenAI(api_key=token, base_url="https://ai-gateway.vercel.sh/v1")
    response = await client.chat.completions.create(
        model=LLM,
        messages=[{
            "role": "user",
            "content": PROMPT.format(about=profile["about"], topics=", ".join(profile["topics"]) or "none", **article),
        }],
        response_format={"type": "json_schema", "json_schema": {"name": "score", "schema": SCORE_SCHEMA}},
    )
    return json.loads(response.choices[0].message.content)


def connect():
    # autocommit, so each score shows up in the feed as soon as it's written
    return psycopg.AsyncConnection.connect(os.environ["DATABASE_URL"], autocommit=True, row_factory=dict_row)


async def fetch_all(conn: psycopg.AsyncConnection, query: str, *params) -> list[dict]:
    cursor = await conn.execute(query, params)
    return await cursor.fetchall()


async def score(conn: psycopg.AsyncConnection, articles: list[dict]) -> None:
    profile = next(iter(await fetch_all(conn, "select about, topics from profile")), None)
    if not profile:
        return  # nothing to score against until you say what you care about

    interests = [profile["about"], *profile["topics"]]
    relevant = [article for article in articles if is_relevant(article, interests)]
    print(f"[scorer] {len(relevant)} of {len(articles)} articles look relevant; asking the LLM to score them")
    results = await asyncio.gather(*(judge(article, profile) for article in relevant))
    for article, result in zip(relevant, results):
        await conn.execute(
            """
            insert into scores (article_id, score, why) values (%s, %s, %s)
            on conflict (article_id) do update set score = excluded.score, why = excluded.why
            """,
            (article["id"], result["score"], result["why"]),
        )
        print(f"[scorer] {result['score']:>3}  {article['title']}")


async def scan() -> None:
    stories = await fetch_stories()
    async with await connect() as conn:
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
        await score(conn, new)


@subscribe(topic="rescore", consumer_group="scorer")
async def on_rescore(message: dict[str, str]) -> None:
    print("[scorer] your interests changed; rescoring recent articles")
    async with await connect() as conn:
        articles = await fetch_all(
            conn, "select id, title, source, text from articles where published_at > now() - interval '3 days'"
        )
        await score(conn, articles)


async def scan_until(stop: asyncio.Event) -> None:
    while not stop.is_set():
        try:
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
