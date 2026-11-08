import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { getFeed, getFeedTopics, getProfile, type FeedItem, type Sort } from "@/lib/db";
import { timeAgo } from "@/lib/time";
import { AutoRefresh } from "./auto-refresh";
import { AskAbout } from "./guide";

const SORTS: { value: Sort; label: string }[] = [
  { value: "relevance", label: "Most relevant" },
  { value: "latest", label: "Latest" },
];

// The sort and filter live in the URL, so every view is a link you can share.
function feedUrl(sort: Sort, filter: string | null) {
  const params = new URLSearchParams();
  if (sort !== "relevance") params.set("sort", sort);
  if (filter) params.set("filter", filter);
  return params.size ? `/?${params}` : "/";
}

export default async function FeedPage({ searchParams }: PageProps<"/">) {
  await connection(); // render on every request; the feed changes as the scorer writes
  if (!(await getProfile())) redirect("/interests");

  const params = await searchParams;
  const sort: Sort = params.sort === "latest" ? "latest" : "relevance";
  const topics = await getFeedTopics();
  const filters = [
    { value: null, label: "All" },
    ...topics.map((topic) => ({ value: topic, label: topic })),
    { value: "no-match", label: "No match" },
  ];
  const filter = filters.find(({ value }) => value === params.filter)?.value ?? null;
  const feed = await getFeed(sort, filter);

  return (
    <section>
      <nav aria-label="Sort" className="flex gap-1 rounded-lg bg-surface p-1 text-sm w-fit">
        {SORTS.map(({ value, label }) => (
          <Link
            key={value}
            href={feedUrl(value, filter)}
            aria-current={sort === value ? "page" : undefined}
            className="rounded-md px-3 py-1.5 text-muted hover:text-foreground aria-[current=page]:bg-background aria-[current=page]:text-foreground aria-[current=page]:shadow-sm"
          >
            {label}
          </Link>
        ))}
      </nav>
      <nav aria-label="Filter" className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 text-sm [scrollbar-width:none]">
        {filters.map(({ value, label }) => (
          <Link
            key={label}
            href={feedUrl(sort, value)}
            aria-current={filter === value ? "page" : undefined}
            className="shrink-0 rounded-full border border-line px-3 py-1 whitespace-nowrap text-muted hover:text-foreground aria-[current=page]:border-accent aria-[current=page]:bg-accent aria-[current=page]:text-white"
          >
            {label}
          </Link>
        ))}
      </nav>
      <AutoRefresh />


      {feed.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-line p-10 text-center text-muted">
          {filter ? "No stories here yet." : "Scanning the news…"}
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
          <Badge item={item} />
          <div className="min-w-0">
            <h2 className="font-medium">{item.title}</h2>
            <p className="mt-1 text-xs text-muted">
              {[item.source, timeAgo(item.published_at), ...item.topics].join(" · ")}
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
          <AskAbout story={{ id: item.id, title: item.title }} />
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

// A score, or why there isn't one: the quick check said it's not a match, or it hasn't been checked yet.
function Badge({ item }: { item: FeedItem }) {
  const label = { scored: String(item.score), "no-match": "No match", pending: "…" }[item.status];
  return (
    <span
      title={item.status === "pending" ? "Not scored yet" : undefined}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface text-center ${
        item.status === "scored" ? "font-semibold" : "text-[10px] leading-tight text-muted"
      }`}
    >
      {label}
    </span>
  );
}
