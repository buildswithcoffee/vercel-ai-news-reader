-- Runs on every build (scripts/migrate.mjs), so every statement must be safe to repeat.

create table if not exists users (
  id        text primary key,  -- Clerk user id
  interests text[] not null default '{}'
);

create table if not exists stories (
  id           text primary key,  -- hash of the URL
  url          text not null unique,
  title        text not null,
  source       text not null,
  published_at timestamptz not null,
  text         text not null  -- the feed's excerpt at first; the scorer swaps in the full article
);

create table if not exists user_story_scores (
  user_id  text not null references users (id) on delete cascade,
  story_id text not null references stories (id) on delete cascade,
  score    integer not null,  -- 0 to 100
  why      text not null,     -- why this story matters to this user
  primary key (user_id, story_id)
);
