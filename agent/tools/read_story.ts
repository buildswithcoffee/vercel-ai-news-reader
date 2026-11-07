import { neon } from "@neondatabase/serverless";
import { defineTool } from "eve/tools";
import { z } from "zod";

// The scorer already read each article safely and saved its text, so the guide reads that copy
// from the database instead of fetching pages from the open web.
export default defineTool({
  description: "Read a story from the reader's feed: the article's text, its score, why it matters to them, and their interests.",
  inputSchema: z.object({ id: z.string().max(64).describe("The story's id, from list_feed or the page context.") }),
  async execute({ id }) {
    const sql = neon(process.env.DATABASE_URL!);
    const [story] = await sql`
      select a.title, a.source, a.url, a.published_at, a.author, a.description, a.text,
        s.score, s.why, (select about from profile) as reader_interests
      from articles a
      left join scores s on s.article_id = a.id
      where a.id = ${id}
    `;
    if (!story) throw new Error(`No story with id ${id}.`);
    return story;
  },
});
