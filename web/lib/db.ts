import "server-only";
import { headers } from "next/headers";
import { isProfileOwner } from "./profile-owner";
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
};

export async function getProfile(): Promise<Profile | null> {
  const [row] = await sql`select about, topics from profile`;
  return (row as Profile) ?? null;
}

export async function saveProfile({ about, topics }: Profile) {
  // Server Actions are public endpoints; never rely on the page's proxy alone.
  if (!isProfileOwner((await headers()).get("authorization"))) {
    throw new Error("Unauthorized");
  }
  about = about.trim();
  topics = [...new Set(topics)].sort();
  if (!about || about.length > 2000 || topics.length > 10 ||
      topics.some((topic) => !topic || topic.length > 100)) {
    throw new Error("Invalid profile");
  }

  // The row lock in ON CONFLICT makes admission atomic across web instances.
  // Delete old scores only when a changed profile is actually admitted.
  const [row] = await sql`
    with changed as (
      insert into profile (about, topics) values (${about}, ${topics})
      on conflict (id) do update set
        about = excluded.about, topics = excluded.topics,
        version = profile.version + 1, updated_at = now()
      where (profile.about, profile.topics) is distinct from (excluded.about, excluded.topics)
        and profile.updated_at <= now() - interval '15 minutes'
      returning version
    ), cleared as (
      delete from scores where exists (select 1 from changed)
    )
    select exists (select 1 from changed) as changed,
      exists (select 1 from profile where about = ${about} and topics = ${topics}) as unchanged
  `;
  if (!row.changed && !row.unchanged) {
    throw new Error("Profile changes are limited to once every 15 minutes. Please try again later.");
  }
  return Boolean(row.changed);
}

export async function getFeed(): Promise<FeedItem[]> {
  const rows = await sql`
    select a.id, a.url, a.title, a.source, a.published_at, s.score, s.why
    from articles a
    left join scores s on s.article_id = a.id
    order by a.published_at desc
    limit 50
  `;
  return rows as FeedItem[];
}
