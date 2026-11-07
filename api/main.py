"""Signal's private API. It has no public route; only the web app reaches it, through its service binding."""

from fastapi import FastAPI
from vercel.queue import ALL_DEPLOYMENTS, QueueClient

app = FastAPI()

# The scorer daemon isn't tied to a deployment, so it polls the queue's shared, deployment-wide
# space. Send there too, in the same pinned region, or it never sees these messages.
queue = QueueClient(region="iad1", deployment=ALL_DEPLOYMENTS)


@app.post("/rescore")
async def rescore():
    """Your interests changed, so ask the scorer daemon to rescore recent articles."""
    await queue.send("rescore", {})
    print("[api] queued a rescore")
    return {"queued": True}
