import { neon } from "@neondatabase/serverless";
import { defineTool } from "eve/tools";
import { z } from "zod";

// The scorer already read each article safely and saved it, so the guide reads from the database
// instead of fetching pages from the open web. It gets what the open story shows, not the full text:
// Signal is public, and the guide must not become a way to copy whole articles.
export default defineTool({
  description:
    "Read a story from the reader's feed: what Signal took from it (why it matters, takeaways, key passages with notes) and the article's opening.",
  inputSchema: z.object({ id: z.string().max(64).describe("The story's id, from list_feed or the page context.") }),
  async execute({ id }) {
    const sql = neon(process.env.DATABASE_URL!);
    const [story] = await sql`
      select a.title, a.source, a.url, a.published_at, a.author, a.description, left(a.text, 600) as opening,
        s.score, s.why, s.detail, s.takeaways, s.reading as passages
      from articles a
      left join scores s on s.article_id = a.id
      where a.id = ${id}
    `;
    if (!story) throw new Error(`No story with id ${id}.`);
    return story;
  },
});
