import { neon } from "@neondatabase/serverless";
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "List the past week's most relevant stories in the reader's feed, with their ids, scores, and why each matters.",
  inputSchema: z.object({}),
  async execute() {
    const sql = neon(process.env.DATABASE_URL!);
    const stories = await sql`
      select a.id, a.title, a.source, a.published_at, s.score, s.why
      from articles a
      join scores s on s.article_id = a.id
      where a.published_at > now() - interval '7 days'
        and a.source in (select name from feeds where enabled)
      order by s.score desc
      limit 20
    `;
    const [profile] = await sql`select about from profile`;
    return { reader_interests: profile?.about ?? null, stories };
  },
});
