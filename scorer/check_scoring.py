"""Offline regression: python scorer/check_scoring.py.

Uses the real scorer with fake LLM/database calls. No embedding model download,
credentials, or external services are required; install scorer/requirements.txt.
"""

import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

# The embedding model is unrelated to score preparation; do not download it.
with patch("fastembed.TextEmbedding"):
    import worker


PROFILE = {"about": "AI news", "topics": ["AI"]}


def answer():
    return {
        "score": 80,
        "why": "Relevant news",
        "detail": "",
        "topics": ["AI", "unknown"],
        "points": [{"quote": "Useful news", "note": "Worth reading"}],
        "takeaways": ["A useful update"],
    }


def articles():
    # More than one batch: a failure must not prevent the last article's score.
    return [
        {"id": str(index), "title": f"Story {index}", "source": "Hacker News", "text": text}
        for index, text in enumerate(["", " \n\t\n", "Useful news", "Useful news", "Useful news"])
    ]


class ReadingChecks(unittest.TestCase):
    def test_empty_and_blank_articles(self):
        for text in ("", " \n\t\n"):
            with self.subTest(text=text):
                self.assertEqual(worker.reading(text, []), [])
                self.assertEqual(worker.reading(text, answer()["points"]), [])

    def test_openings_gaps_and_utf16_marks(self):
        self.assertEqual(worker.reading(" Only paragraph ", []), [{"text": "Only paragraph", "gap": False}])
        self.assertEqual(worker.reading("First\n\nSecond", []), [
            {"text": "First", "gap": False}, {"text": "Second", "gap": False},
        ])
        self.assertEqual(worker.reading("First\nSecond\nSkipped\n😀 Useful   news", answer()["points"]), [
            {"text": "First", "gap": False},
            {"text": "Second", "gap": False},
            {"text": "😀 Useful   news", "gap": True, "mark": [3, 16], "note": "Worth reading"},
        ])


class ScoringChecks(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.conn = MagicMock()
        self.conn.execute = AsyncMock()
        self.conn.cursor.return_value.__aenter__.return_value = AsyncMock()
        self.judge = AsyncMock(side_effect=lambda *_: answer())
        self.patches = [
            patch.object(worker, "llm_slots", asyncio.Semaphore(worker.LLM_CONCURRENCY)),
            patch.object(worker, "is_relevant", return_value=True),
            patch.object(worker, "judge", self.judge),
        ]
        for mock in self.patches:
            mock.start()
            self.addCleanup(mock.stop)

    async def test_empty_articles_and_later_batches_are_saved(self):
        await worker.score(self.conn, articles(), PROFILE)
        self.assertEqual(self.judge.await_count, 5)
        rows = {call.args[1][0]: call.args[1] for call in self.conn.execute.await_args_list}
        self.assertEqual(set(rows), {"0", "1", "2", "3", "4"})
        for article_id in ("0", "1"):
            self.assertEqual(rows[article_id][7].obj, [])
        self.assertIsNone(rows["2"][3])  # an empty detail is stored as no detail
        self.assertEqual(rows["2"][4], ["AI"])
        self.assertEqual(rows["2"][7].obj[0]["text"], "Useful news")

    async def assert_isolated(self):
        await worker.score(self.conn, articles(), PROFILE)
        self.assertEqual(self.judge.await_count, 5)
        saved = {call.args[1][0] for call in self.conn.execute.await_args_list}
        self.assertEqual(saved, {"1", "2", "3", "4"})

    async def test_malformed_answer_is_isolated(self):
        def judge(article, profile):
            return {**answer(), "points": None} if article["id"] == "0" else answer()

        self.judge.side_effect = judge
        await self.assert_isolated()

    async def test_reading_failure_is_isolated(self):
        reading = worker.reading

        def build(text, points):
            if text == "":
                raise ValueError("bad reading")
            return reading(text, points)

        with patch.object(worker, "reading", side_effect=build):
            await self.assert_isolated()

    async def test_judge_failure_is_isolated(self):
        def judge(article, profile):
            if article["id"] == "0":
                raise ValueError("bad answer")
            return answer()

        self.judge.side_effect = judge
        await self.assert_isolated()

    async def test_cancellation_propagates(self):
        self.judge.side_effect = asyncio.CancelledError()
        with self.assertRaises(asyncio.CancelledError):
            await worker.score(self.conn, articles()[:1], PROFILE)
        self.conn.execute.assert_not_awaited()



class ScanChecks(unittest.IsolatedAsyncioTestCase):
    """A page that fails to read is retried on later scans, and rescored once it reads."""

    async def scan(self, new, claimed, pages):
        conn = MagicMock()
        conn.execute = AsyncMock()
        queries = iter([[{"name": "Feed", "url": "https://example.com/feed"}], *([row] for row in new), claimed])
        connect = AsyncMock(return_value=MagicMock(
            __aenter__=AsyncMock(return_value=conn), __aexit__=AsyncMock(return_value=False)))
        story = MagicMock(id="x", url="u", title="t", source="s", published_at=None, text="feed summary")
        score = AsyncMock()
        with (
            patch.object(worker, "connect", connect),
            patch.object(worker, "fetch_all", AsyncMock(side_effect=lambda *_: next(queries))),
            patch.object(worker, "fetch_stories", AsyncMock(return_value=[story] * len(new))),
            patch.object(worker, "read_article", AsyncMock(side_effect=lambda url: pages.get(url))),
            patch.object(worker, "score", score),
        ):
            await worker.scan()
        updates = [call.args[1] for call in conn.execute.await_args_list]
        scored = score.await_args.args[1] if score.await_args else []
        return updates, scored

    async def test_new_and_retried_pages(self):
        page = {"text": "the full article", "image": None, "description": "d", "author": None}
        new = [{"id": "new", "url": "new-url", "title": "New", "source": "s", "text": "feed summary"}]
        claimed = new + [
            {"id": "retry", "url": "retry-url", "title": "Retried", "source": "s", "text": "old summary"},
            {"id": "still-down", "url": "down-url", "title": "Down", "source": "s", "text": "summary"},
        ]
        updates, scored = await self.scan(new, claimed, {"new-url": page, "retry-url": page})
        self.assertEqual([update[-1] for update in updates], ["new", "retry"])  # read_at set only when read
        self.assertEqual([article["id"] for article in scored], ["new", "retry"])  # still-down keeps waiting
        self.assertTrue(all(article["text"] == "the full article" for article in scored))

    async def test_new_article_whose_page_fails_is_still_scored(self):
        new = [{"id": "new", "url": "new-url", "title": "New", "source": "s", "text": "feed summary"}]
        updates, scored = await self.scan(new, new, {})
        self.assertEqual(updates, [])
        self.assertEqual([(article["id"], article["text"]) for article in scored], [("new", "feed summary")])


if __name__ == "__main__":
    unittest.main()
