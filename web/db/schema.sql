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
insert into feeds (name, url, enabled) values
  ('Hacker News',            'https://news.ycombinator.com/',                                   true),
  ('The Verge',              'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', true),
  ('TechCrunch',             'https://techcrunch.com/category/artificial-intelligence/feed/',   true),
  ('Ars Technica',           'https://feeds.arstechnica.com/arstechnica/technology-lab',        true),
  ('Google AI',              'https://blog.google/technology/ai/rss/',                          true),
  ('Vercel',                 'https://vercel.com/atom',                                         true),
  ('Hugging Face',           'https://huggingface.co/blog/feed.xml',                            true),
  ('OpenAI',                 'https://openai.com/news/rss.xml',                                 true),
  ('AWS re:Invent',          'https://aws.amazon.com/blogs/aws/category/events/reinvent/feed/', true),
  ('Google DeepMind',        'https://deepmind.google/blog/rss.xml',                            false),
  ('NVIDIA',                 'https://blogs.nvidia.com/feed/',                                  false),
  ('GitHub',                 'https://github.blog/feed/',                                       false),
  ('Cloudflare',             'https://blog.cloudflare.com/rss/',                                false),
  ('Next.js',                'https://nextjs.org/feed.xml',                                     false),
  ('AWS Machine Learning',   'https://aws.amazon.com/blogs/machine-learning/feed/',             false),
  ('Apple Machine Learning', 'https://machinelearning.apple.com/rss.xml',                       false),
  ('Meta Engineering',       'https://engineering.fb.com/feed/',                                false),
  ('Databricks',             'https://www.databricks.com/feed',                                 false),
  ('Together AI',            'https://www.together.ai/blog/rss.xml',                            false),
  ('Simon Willison',         'https://simonwillison.net/atom/everything/',                      false),
  ('Latent Space',           'https://www.latent.space/feed',                                   false),
  ('Interconnects',          'https://www.interconnects.ai/feed',                               false),
  ('Stratechery',            'https://stratechery.com/feed/',                                   false)
on conflict (name) do nothing;

-- Every article the scorer checks gets a scores row. A null score means the quick check found it
-- isn't a match, so it never went to the LLM. No row means it hasn't been checked (or scoring failed).
alter table scores alter column score drop not null;
alter table scores alter column why drop not null;
alter table scores add column if not exists topics text[] not null default '{}';  -- which of your topics it covers
