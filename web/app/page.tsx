import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { getFeed, getProfile, type FeedItem } from "@/lib/db";
import { timeAgo } from "@/lib/time";
import { AutoRefresh } from "./auto-refresh";

export default async function FeedPage() {
  await connection(); // render on every request; the feed changes as the scorer writes
  const profile = await getProfile();
  if (!profile) redirect("/interests");

  const feed = await getFeed();

  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Your briefing</h1>
          <p className="mt-1 truncate text-sm text-muted">
            Tuned for “{profile.about}”{" "}
            <Link href="/interests" className="underline underline-offset-2 hover:text-foreground">
              Edit
            </Link>
          </p>
        </div>
        <AutoRefresh />
      </div>

      {feed.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-line p-10 text-center text-muted">
          Scanning the news…
        </p>
      ) : (
        <ol className="mt-8 space-y-4">
          {feed.map((item) => (
            <Story key={item.id} item={item} />
          ))}
        </ol>
      )}
    </section>
  );
}

function Story({ item }: { item: FeedItem }) {
  return (
    <li className="flex gap-4 rounded-xl border border-line p-5">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface font-semibold ${
          item.score === null ? "text-muted" : ""
        }`}
      >
        {item.score ?? "–"}
      </span>
      <div className="min-w-0">
        <a href={item.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
          {item.title}
        </a>
        <p className="mt-1 text-xs text-muted">
          {item.source} · {timeAgo(item.published_at)}
        </p>
        {item.why && (
          <p className="mt-3 rounded-md bg-surface px-3 py-2 text-sm">
            <span className="font-medium text-accent">Why it matters to you: </span>
            {item.why}
          </p>
        )}
      </div>
    </li>
  );
}
