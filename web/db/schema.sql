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
