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


if __name__ == "__main__":
    unittest.main()
