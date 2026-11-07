import "server-only";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export type Profile = { about: string; topics: string[] };

export type FeedItem = {
  id: string;
  url: string;
  title: string;
  source: string;
  published_at: string;
  score: number | null; // null until the scorer has judged it
  why: string | null;
  // The preview you see when you expand a story. Null when the site blocks readers.
  image: string | null;
  description: string | null;
  author: string | null;
  excerpt: string; // the article's opening; the rest stays at the source
};

export async function getProfile(): Promise<Profile | null> {
  const [row] = await sql`select about, topics from profile`;
  return (row as Profile) ?? null;
}

export async function saveProfile({ about, topics }: Profile) {
  await sql.transaction([
    sql`
      insert into profile (about, topics) values (${about}, ${topics})
      on conflict (id) do update set about = excluded.about, topics = excluded.topics
    `,
    // Scores were written for your old profile, so they no longer apply.
    sql`delete from scores`,
  ]);
}

export async function getFeed(): Promise<FeedItem[]> {
  const rows = await sql`
    select a.id, a.url, a.title, a.source, a.published_at, s.score, s.why,
      a.image, a.description, a.author, left(a.text, 600) as excerpt
    from articles a
    left join scores s on s.article_id = a.id
    order by a.published_at desc
    limit 50
  `;
  return rows as FeedItem[];
}
