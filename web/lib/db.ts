import "server-only";
import { headers } from "next/headers";
import { isProfileOwner } from "./profile-owner";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export type Profile = { about: string; topics: string[] };

export type Source = { name: string; url: string; enabled: boolean };

export type FeedItem = {
  id: string;
  url: string;
  title: string;
  source: string;
  published_at: string;
  status: "scored" | "no-match" | "pending"; // no-match: the quick check said skip it; pending: not checked yet
  score: number | null;
  why: string | null;
  topics: string[]; // which of your topics it covers
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

export async function getSources(): Promise<Source[]> {
  return (await sql`select name, url, enabled from feeds order by enabled desc, name`) as Source[];
}

export async function setSourceEnabled(name: string, enabled: boolean) {
  if (!isProfileOwner((await headers()).get("authorization"))) {
    throw new Error("Unauthorized");
  }
  await sql`update feeds set enabled = ${enabled} where name = ${name}`;
}

export type Sort = "relevance" | "latest";

// The filter is "no-match" or a topic; null shows everything.
export async function getFeed(sort: Sort, filter: string | null): Promise<FeedItem[]> {
  // Relevance ranks the past week by score. Stories without one come last.
  const rows = await sql`
    select a.id, a.url, a.title, a.source, a.published_at, s.score, s.why,
      case when s.article_id is null then 'pending' when s.score is null then 'no-match' else 'scored' end as status,
      coalesce(s.topics, '{}') as topics,
      a.image, a.description, a.author, left(a.text, 600) as excerpt
    from articles a
    left join scores s on s.article_id = a.id
    where a.source in (select name from feeds where enabled)
      and (${sort} = 'latest' or a.published_at > now() - interval '7 days')
      and (${filter}::text is null
        or (${filter} = 'no-match' and s.article_id is not null and s.score is null)
        or ${filter} = any(s.topics))
    order by case when ${sort} = 'relevance' then s.score end desc nulls last, a.published_at desc
    limit 50
  `;
  return rows as FeedItem[];
}

// The topics on this week's stories, for the feed's filter. Read from the stories, not from your
// saved interests, which stay private.
export async function getFeedTopics(): Promise<string[]> {
  const rows = await sql`
    select distinct unnest(s.topics) as topic
    from scores s
    join articles a on a.id = s.article_id
    where a.published_at > now() - interval '7 days' and a.source in (select name from feeds where enabled)
    order by topic
  `;
  return rows.map((row) => row.topic as string);
}
