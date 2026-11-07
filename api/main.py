"""Signal's private API. It has no public route; only the web app reaches it, through its service binding."""

from fastapi import FastAPI
from vercel.queue import QueueClient

app = FastAPI()

# Pinned so the scorer daemon always polls the region these messages are sent to.
queue = QueueClient(region="iad1")


@app.post("/rescore")
async def rescore():
    """Your interests changed, so ask the scorer daemon to rescore recent articles."""
    await queue.send("rescore", {})
    return {"queued": True}
