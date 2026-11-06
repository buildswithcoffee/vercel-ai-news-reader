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

export async function getInterests(userId: string): Promise<string[]> {
  const rows = await sql`select interests from users where id = ${userId}`;
  return rows[0]?.interests ?? [];
}

export async function saveInterests(userId: string, interests: string[]) {
  await sql`
    insert into users (id, interests) values (${userId}, ${interests})
    on conflict (id) do update set interests = excluded.interests
  `;
  // Scores were written for the old interests, so they no longer apply.
  await sql`delete from user_story_scores where user_id = ${userId}`;
}

export async function getFeed(userId: string): Promise<FeedItem[]> {
  const rows = await sql`
    select s.id, s.url, s.title, s.source, s.published_at, u.score, u.why
    from user_story_scores u
    join stories s on s.id = u.story_id
    where u.user_id = ${userId}
    order by u.score desc
    limit 50
  `;
  return rows as FeedItem[];
}
