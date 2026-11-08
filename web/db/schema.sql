-- Runs on every build (scripts/migrate.mjs), so every statement must be safe to repeat.

create table if not exists profile (
  id     boolean primary key default true check (id),  -- a single row: each deployment has one reader
  about  text not null,                                -- what you care about, in your own words
  topics text[] not null default '{}'
);

create table if not exists articles (
  id           text primary key,  -- hash of the URL
  url          text not null unique,
  title        text not null,
  source       text not null,
  published_at timestamptz not null,
  text         text not null  -- the full article, or the feed's excerpt if the site blocks readers
);

-- Shown when you expand a story. Read from the article page along with its text.
alter table articles add column if not exists image       text;  -- the lead photo's URL
alter table articles add column if not exists description text;  -- the publisher's one-line summary
alter table articles add column if not exists author      text;

create table if not exists scores (
  article_id text primary key references articles (id) on delete cascade,
  score      integer not null,  -- 0 to 100
  why        text not null      -- why this article matters to you
);

-- Additive migration for existing installations. Versions coalesce queue redelivery;
-- timestamps enforce a shared quota rather than a per-process/IP limit.
alter table profile add column if not exists version bigint not null default 1;
alter table profile add column if not exists updated_at timestamptz not null default now();

create table if not exists rescore_state (
  id boolean primary key default true check (id),
  version bigint not null default 0,
  started_at timestamptz
);
insert into rescore_state (id) values (true) on conflict do nothing;

-- Where articles come from. Turn a feed off on the Sources page and the scorer stops reading it
-- and its stories leave your feed. New rows here show up on the next deploy; existing ones keep
-- whatever you chose.
create table if not exists feeds (
  name    text primary key,  -- shown on each story, and matched against articles.source
  url     text not null,     -- an RSS or Atom feed; Hacker News is read through its API
  enabled boolean not null
);
-- The Your feed page groups sources by kind. Re-seeding updates each source's kind and URL but
-- keeps whether you turned it on.
alter table feeds add column if not exists kind text not null default 'News';
insert into feeds (name, kind, url, enabled) values
  ('Hacker News',            'News',      'https://news.ycombinator.com/',                                       true),
  ('The Verge',              'News',      'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',   true),
  ('TechCrunch',             'News',      'https://techcrunch.com/category/artificial-intelligence/feed/',       true),
  ('Ars Technica',           'News',      'https://feeds.arstechnica.com/arstechnica/technology-lab',            true),
  ('Google AI',              'AI labs',   'https://blog.google/technology/ai/rss/',                              true),
  ('OpenAI',                 'AI labs',   'https://openai.com/news/rss.xml',                                     true),
  ('Google DeepMind',        'AI labs',   'https://deepmind.google/blog/rss.xml',                                false),
  ('Apple Machine Learning', 'AI labs',   'https://machinelearning.apple.com/rss.xml',                           false),
  ('Vercel',                 'Platforms', 'https://vercel.com/atom',                                             true),
  ('Hugging Face',           'Platforms', 'https://huggingface.co/blog/feed.xml',                                true),
  ('AWS re:Invent',          'Platforms', 'https://aws.amazon.com/blogs/aws/category/events/reinvent/feed/',     true),
  ('NVIDIA',                 'Platforms', 'https://blogs.nvidia.com/feed/',                                      false),
  ('GitHub',                 'Platforms', 'https://github.blog/feed/',                                           false),
  ('Cloudflare',             'Platforms', 'https://blog.cloudflare.com/rss/',                                    false),
  ('Next.js',                'Platforms', 'https://nextjs.org/feed.xml',                                         false),
  ('AWS Machine Learning',   'Platforms', 'https://aws.amazon.com/blogs/machine-learning/feed/',                 false),
  ('Meta Engineering',       'Platforms', 'https://engineering.fb.com/feed/',                                    false),
  ('Databricks',             'Platforms', 'https://www.databricks.com/feed',                                     false),
  ('Together AI',            'Platforms', 'https://www.together.ai/blog/rss.xml',                                false),
  ('Simon Willison',         'Writers',   'https://simonwillison.net/atom/everything/',                          false),
  ('Latent Space',           'Writers',   'https://www.latent.space/feed',                                       false),
  ('Interconnects',          'Writers',   'https://www.interconnects.ai/feed',                                   false),
  ('Stratechery',            'Writers',   'https://stratechery.com/feed/',                                       false)
on conflict (name) do update set kind = excluded.kind, url = excluded.url;

-- Every article the scorer checks gets a scores row. A null score means the quick check found it
-- isn't a match, so it never went to the LLM. No row means it hasn't been checked (or scoring failed).
alter table scores alter column score drop not null;
alter table scores alter column why drop not null;
alter table scores add column if not exists topics text[] not null default '{}';  -- which of your topics it covers
alter table scores add column if not exists points jsonb not null default '[]';  -- key passages, each with Signal's note
alter table scores add column if not exists takeaways text[] not null default '{}';  -- 2 to 4 bullets for the open story
alter table scores add column if not exists reading jsonb not null default '[]';     -- the article as the open story shows it

-- Follow-ups (behind the follow-ups flag): to-dos you save from a story, like telling a coworker.
create table if not exists follow_ups (
  id         bigint generated always as identity primary key,
  article_id text not null references articles (id) on delete cascade,
  task       text not null,
  done       boolean not null default false,
  created_at timestamptz not null default now()
);
alter table scores add column if not exists detail text;  -- the rest of why it matters, shown when the story is open

-- Whether the scorer has read the article's page (read_at), or so far has only the feed's summary.
-- Pages that fail are retried a few times (read_attempts).
alter table articles add column if not exists read_at timestamptz;
alter table articles add column if not exists read_attempts integer not null default 0;
-- Articles saved before read_at existed: page details (photo, summary) mean the page was read.
update articles set read_at = published_at
where read_at is null and read_attempts = 0 and (image is not null or description is not null);

-- For a story Signal only has the headline of, another source's readable story about the same news.
-- Signal interprets the story from that coverage, links both, and hides the coverage as a duplicate.
alter table articles add column if not exists covered_by text references articles (id) on delete set null;
