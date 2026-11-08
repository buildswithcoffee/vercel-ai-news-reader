"""Signal's scorer. Runs continuously as a Vercel Daemon:

- Every 15 minutes it scans the news sources, reads each new article, and scores it.
- When you change your interests, the web app queues a "rescore" and it rescores recent articles.
"""

import asyncio
import json
import re
import os
import signal
from functools import lru_cache
from pathlib import Path

import numpy as np
import psycopg
from fastembed import TextEmbedding
from openai import AsyncOpenAI
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from vercel.queue import ALL_DEPLOYMENTS, QueueClient, subscribe

from articles import read_article
from sources import fetch_stories

SCAN_EVERY_SECONDS = 15 * 60
READ_ATTEMPTS = 3  # tries at reading an article's page before keeping its feed summary
READ_BATCH_SIZE = 100
RESCORE_BATCH_SIZE = 100
LLM_CONCURRENCY = 4
llm_slots = asyncio.Semaphore(LLM_CONCURRENCY)
# A cheap local embedding model filters articles before any LLM call. Only articles whose headline
# and opening are at least this similar to one of your interests get scored.
RELEVANCE_THRESHOLD = 0.6
LLM = "anthropic/claude-haiku-5.5"

embedder = TextEmbedding("BAAI/bge-small-en-v1.5")  # downloaded into the image at build time


PROMPT = """You help a reader decide which tech news is worth their time.
What they care about, in their words: {about}
Topics they follow: {topics}
Headline: {title} ({source})
Article (may be cut short): {text}

Rate from 0 to 100 how much this story matters to them. Then explain why in one line of at most
25 words, speaking to them as "you". If there's more worth saying, add 2 or 3 sentences (at most 60
words) with the rest of why it matters to them; otherwise leave that empty. If they follow topics,
list the ones this story is about.

Then list 2 to 4 key takeaways from the article, each at most 15 words.

Then pick up to 3 key points. For each, copy a short passage from the article word for word (at
most 25 words), and add a note of at most 20 words on what it means for them.
Use only what the article says; don't invent details."""


def answer_schema(topics: list[str]) -> dict:
    properties = {
        "score": {"type": "integer"},
        "why": {"type": "string"},
        "detail": {"type": "string"},
        "takeaways": {"type": "array", "items": {"type": "string"}},
        "points": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"quote": {"type": "string"}, "note": {"type": "string"}},
                "required": ["quote", "note"],
                "additionalProperties": False,
            },
        },
    }
    if topics:  # tags for the feed's filter, chosen only from the reader's own topics
        properties["topics"] = {"type": "array", "items": {"type": "string", "enum": topics}}
    return {"type": "object", "properties": properties, "required": list(properties), "additionalProperties": False}


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
        max_tokens=1536,  # room for the whole answer; you pay only for what the model writes
        messages=[{
            "role": "user",
            "content": PROMPT.format(about=profile["about"], topics=", ".join(profile["topics"]) or "none", **article),
        }],
        response_format={"type": "json_schema", "json_schema": {"name": "score", "schema": answer_schema(profile["topics"])}},
    )
    choice = response.choices[0]
    if choice.finish_reason == "length":
        raise ValueError("the answer was cut off at max_tokens")
    return json.loads(choice.message.content)


# Compare passages loosely: ignore spacing, case, and curly vs straight quotes.
STRAIGHT_QUOTES = str.maketrans("‘’“”", "''\"\"")


def squash(text: str) -> str:
    return " ".join(text.translate(STRAIGHT_QUOTES).split()).lower()


def find(passage: str, paragraph: str) -> re.Match | None:
    # The same loose match, as a span of the original paragraph (the translation keeps its length).
    words = (re.escape(word) for word in passage.translate(STRAIGHT_QUOTES).split())
    return re.search(r"\s+".join(words), paragraph.translate(STRAIGHT_QUOTES), re.IGNORECASE)


# The web app slices strings in UTF-16 code units, where an emoji counts as two.
def js_index(text: str, index: int) -> int:
    return len(text[:index].encode("utf-16-le")) // 2


# What the open story shows of the article: the first two paragraphs, plus each paragraph that holds
# a key passage, marked, with Signal's note. "gap" means paragraphs were skipped before this one;
# the rest of the article stays at the source.
def reading(text: str, points: list[dict]) -> list[dict]:
    paragraphs = [paragraph.strip() for paragraph in text.split("\n") if paragraph.strip()]
    if not paragraphs:
        return []
    shown = {0: None, 1: None} if len(paragraphs) > 1 else {0: None}
    for point in points:
        for index, paragraph in enumerate(paragraphs):
            if (match := find(point["quote"], paragraph)) and not shown.get(index):
                shown[index] = {"mark": [js_index(paragraph, match.start()), js_index(paragraph, match.end())], "note": point["note"]}
                break
    view, previous = [], -1
    for index in sorted(shown):
        view.append({"text": paragraphs[index], "gap": index > previous + 1, **(shown[index] or {})})
        previous = index
    return view


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
    relevant, no_match = [], []
    for article in articles:
        (relevant if is_relevant(article, interests) else no_match).append(article)
    print(f"[scorer] {len(relevant)} of {len(articles)} articles look relevant; asking the LLM to score them")

    # Record the ones that aren't a match too (a null score), so the feed can tell them apart
    # from articles that haven't been checked yet (no row at all).
    async with conn.cursor() as cursor:
        await cursor.executemany(
            """
            insert into scores (article_id, score, why, topics) values (%s, null, null, '{}')
            on conflict (article_id) do update set score = null, why = null, topics = '{}'
            """,
            [(article["id"],) for article in no_match],
        )

    async def score_one(article: dict) -> None:
        try:
            # Shared with scheduled scans, so simultaneous scan/rescore tasks also stay bounded.
            async with llm_slots:
                result = await judge(article, profile)
            topics = [topic for topic in result.get("topics", []) if topic in profile["topics"]]
            # Show a passage as a quote only if the article really says it.
            points = [point for point in result["points"][:3] if squash(point["quote"]) in squash(article["text"])]
            await conn.execute(
                """
                insert into scores (article_id, score, why, detail, topics, points, takeaways, reading)
                values (%s, %s, %s, %s, %s, %s, %s, %s)
                on conflict (article_id) do update
                  set score = excluded.score, why = excluded.why, detail = excluded.detail, topics = excluded.topics,
                      points = excluded.points, takeaways = excluded.takeaways, reading = excluded.reading
                """,
                (
                    article["id"], result["score"], result["why"], result["detail"].strip() or None, topics, Jsonb(points),
                    result["takeaways"][:4], Jsonb(reading(article["text"], points)),
                ),
            )
            print(f"[scorer] {result['score']:>3}  {article['title']}")
        except Exception as error:  # one bad story must not stop this or later batches
            print(f"[scorer] couldn't score {article['title']}: {error!r}")

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

        # Read the page of each new article, and retry recent ones whose page failed before (the
        # site was slow, down, or blocked us), so one bad moment doesn't leave a story judged on its
        # feed summary forever. Claiming a read counts the attempt, so instances never double up.
        claimed = await fetch_all(
            conn,
            """
            update articles set read_attempts = read_attempts + 1
            where id in (
              select id from articles
              where read_at is null and read_attempts < %s
                and (id = any(%s) or published_at > now() - interval '7 days')
              order by read_attempts, published_at desc
              limit %s
              for update skip locked
            )
            returning id, url, title, source, text
            """,
            READ_ATTEMPTS, [article["id"] for article in new], READ_BATCH_SIZE,
        )
        pages = await asyncio.gather(*(read_article(article["url"]) for article in claimed))
        read = {}
        for article, page in zip(claimed, pages):
            if not page:
                print(f"[scorer] couldn't read {article['url']}; keeping the feed's summary for now")
                continue
            await conn.execute(
                "update articles set text = %s, image = %s, description = %s, author = %s, read_at = now() where id = %s",
                (page["text"], page["image"], page["description"], page["author"], article["id"]),
            )
            read[article["id"]] = {**article, "text": page["text"]}

        # Score the new articles, and rescore older ones whose page we could finally read.
        to_score = [read.pop(article["id"], article) for article in new] + list(read.values())
        print(f"[scorer] scanned {len(stories)} stories, {len(new)} new, {len(read)} read again")
        if to_score:
            await score(conn, to_score)


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
