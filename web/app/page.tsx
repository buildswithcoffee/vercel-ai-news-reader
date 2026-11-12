import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { getFeed, getFeedTopics, getProfile, isOwner, type Sort } from "@/lib/db";
import { followUpsFlag } from "@/flags";
import { AutoRefresh } from "./auto-refresh";
import { Story, type StorySize } from "./story";

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
  if (!(await getProfile())) redirect("/setup");

  const params = await searchParams;
  const sort: Sort = params.sort === "latest" ? "latest" : "relevance";
  const topics = await getFeedTopics();
  const filters = [
    { value: null, label: "All" },
    ...topics.map((topic) => ({ value: topic, label: topic })),
    { value: "no-match", label: "No match" },
  ];
  const filter = filters.find(({ value }) => value === params.filter)?.value ?? null;
  const [feed, followUps] = await Promise.all([getFeed(sort, filter), canFollowUp()]);
  // Ranked by relevance, the feed is laid out like a front page. Latest, and No match, are plain lists.
  const front = sort === "relevance" && filter !== "no-match";

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
            className="shrink-0 rounded-full border border-line px-3 py-1 whitespace-nowrap text-muted hover:text-foreground aria-[current=page]:border-accent aria-[current=page]:bg-accent aria-[current=page]:text-background"
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
        <ol className="mt-8 grid gap-4 sm:grid-cols-2">
          {feed.map((item, index) => (
            <Story key={item.id} item={item} followUps={followUps} size={front ? frontPage(index) : "row"} />
          ))}
        </ol>
      )}
    </section>
  );
}

// The top story leads, the next two are cards, and the rest are rows.
function frontPage(index: number): StorySize {
  return index === 0 ? "lead" : index < 3 ? "card" : "row";
}

// Follow-ups are behind a flag, and only the owner has them.
async function canFollowUp() {
  return (await isOwner()) && (await followUpsFlag());
}
