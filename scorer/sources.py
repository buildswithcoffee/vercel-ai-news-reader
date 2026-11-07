import asyncio
import hashlib
import html
import re
from dataclasses import dataclass
from datetime import datetime, timezone

import feedparser
import httpx

HN_API = "https://hacker-news.firebaseio.com/v0"
STORIES_PER_SOURCE = 20

HACKER_NEWS = "https://news.ycombinator.com/"  # read through its API, not a feed


@dataclass
class Story:
    url: str
    title: str
    source: str
    published_at: datetime
    text: str

    @property
    def id(self) -> str:
        return hashlib.sha1(self.url.encode()).hexdigest()[:16]


async def fetch_stories(feeds: list[dict]) -> list[Story]:
    """Reads each feed you've turned on (rows from the feeds table)."""
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        results = await asyncio.gather(
            *(
                fetch_hacker_news(client) if feed["url"] == HACKER_NEWS else fetch_rss(client, feed["name"], feed["url"])
                for feed in feeds
            ),
            return_exceptions=True,  # one broken feed shouldn't stop the scan
        )

    stories = []
    for result in results:
        if isinstance(result, Exception):
            print(f"[sources] a feed failed: {result!r}")
        else:
            stories.extend(result)
    return stories


async def fetch_hacker_news(client: httpx.AsyncClient) -> list[Story]:
    ids = (await client.get(f"{HN_API}/topstories.json")).json()[:STORIES_PER_SOURCE]
    responses = await asyncio.gather(*(client.get(f"{HN_API}/item/{i}.json") for i in ids))
    items = [response.json() for response in responses]
    return [
        Story(
            url=item["url"],
            title=item["title"],
            source="Hacker News",
            published_at=datetime.fromtimestamp(item["time"], timezone.utc),
            text="",  # Hacker News posts are links; the scorer reads the article itself
        )
        for item in items
        if item and item.get("url")  # skip deleted items and text-only posts like Ask HN
    ]


async def fetch_rss(client: httpx.AsyncClient, source: str, url: str) -> list[Story]:
    feed = feedparser.parse((await client.get(url)).content)
    return [
        Story(
            url=entry.link,
            title=entry.title,
            source=source,
            published_at=entry_time(entry),
            text=plain_text(entry.get("summary", "")),
        )
        for entry in feed.entries[:STORIES_PER_SOURCE]
    ]


def entry_time(entry) -> datetime:
    # RSS feeds set "published", Atom feeds set "updated"
    parsed = entry.get("published_parsed") or entry.updated_parsed
    return datetime(*parsed[:6], tzinfo=timezone.utc)


def plain_text(fragment: str) -> str:
    # Feed excerpts are HTML. A rough strip is enough for model input.
    return html.unescape(re.sub(r"<[^>]+>", " ", fragment)).strip()
