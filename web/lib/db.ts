import "server-only";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export type FeedItem = {
  id: string;
  url: string;
  title: string;
  source: string;
  published_at: string;
  score: number;
  why: string;
};

export async function getInterests(): Promise<string[]> {
  const rows = await sql`select topic from interests order by topic`;
  return rows.map((row) => row.topic);
}

export async function saveInterests(topics: string[]) {
  await sql.transaction([
    sql`delete from interests`,
    sql`insert into interests (topic) select unnest(${topics}::text[])`,
    // Scores were written for the old interests, so they no longer apply.
    sql`delete from scores`,
  ]);
}

export async function getFeed(): Promise<FeedItem[]> {
  const rows = await sql`
    select a.id, a.url, a.title, a.source, a.published_at, s.score, s.why
    from scores s
    join articles a on a.id = s.article_id
    order by a.published_at desc
    limit 50
  `;
  return rows as FeedItem[];
}
