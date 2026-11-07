import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { getFeed, getProfile, type FeedItem } from "@/lib/db";
import { timeAgo } from "@/lib/time";
import { AutoRefresh } from "./auto-refresh";
import { Xray } from "./xray";

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

      <Xray show={["web", "neon", "daemon", "gateway"]} />

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

// Each story expands in place, like a link preview: the photo, the publisher's summary, and the
// opening lines. The full article stays at the source, one click away.
function Story({ item }: { item: FeedItem }) {
  return (
    <li>
      <details name="story" className="rounded-xl border border-line">
        <summary className="flex cursor-pointer list-none gap-4 p-5 hover:bg-surface/50 [&::-webkit-details-marker]:hidden">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface font-semibold ${
              item.score === null ? "text-muted" : ""
            }`}
          >
            {item.score ?? "–"}
          </span>
          <div className="min-w-0">
            <h2 className="font-medium">{item.title}</h2>
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
        </summary>

        <div className="space-y-4 px-5 pb-5 sm:pl-20">
          {item.image && (
            // Photos load straight from the publisher. next/image would have to allow every host,
            // which would turn the image optimizer into an open proxy.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="aspect-video w-full rounded-lg bg-surface object-cover"
            />
          )}
          {item.description && <p className="text-lg leading-snug">{item.description}</p>}
          {item.excerpt && <p className="line-clamp-6 whitespace-pre-line text-sm text-muted">{item.excerpt}</p>}
          <p className="text-sm">
            <a href={item.url} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
              Read the full story at {item.source} →
            </a>
            {item.author && <span className="text-muted"> · By {item.author}</span>}
          </p>
        </div>
      </details>
    </li>
  );
}
