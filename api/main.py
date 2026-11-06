import os

import psycopg
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from vercel.queue import QueueClient

from sources import fetch_stories

app = FastAPI()

# Topic names are shared with the scorer daemon (scorer/worker.py).
NEW_STORIES = "new-stories"
RESCORE_USER = "rescore-user"

# Pinned so the daemon always polls the region these messages are sent to.
queue = QueueClient(region="iad1")


@app.get("/api/ingest")
async def ingest(authorization: str | None = Header(default=None)):
    """Runs on a Vercel Cron Job: saves new stories and queues each one for scoring."""
    if authorization != f"Bearer {os.environ['CRON_SECRET']}":
        raise HTTPException(status_code=401)

    stories = await fetch_stories()
    new_ids = []
    async with await psycopg.AsyncConnection.connect(os.environ["DATABASE_URL"]) as conn:
        for story in stories:
            cursor = await conn.execute(
                """
                insert into stories (id, url, title, source, published_at, text)
                values (%s, %s, %s, %s, %s, %s)
                on conflict do nothing
                returning id
                """,
                (story.id, story.url, story.title, story.source, story.published_at, story.text),
            )
            if await cursor.fetchone():
                new_ids.append(story.id)

    for story_id in new_ids:
        await queue.send(NEW_STORIES, {"story_id": story_id})

    return {"fetched": len(stories), "queued": len(new_ids)}


class RescoreRequest(BaseModel):
    user_id: str


@app.post("/rescore")
async def rescore(request: RescoreRequest):
    """Called by the web app through its service binding after a user changes interests."""
    await queue.send(RESCORE_USER, {"user_id": request.user_id})
    return {"queued": True}
