import type { FeedItem, Paragraph } from "@/lib/db";
import { timeAgo } from "@/lib/time";
import { AskAbout } from "./guide";

// Each story opens like a drawer: key takeaways, the photo and the publisher's summary, then the
// opening of the article and each paragraph Signal flagged, with its note in the margin. The rest
// of the article stays at the source, one click away.
export function Story({ item }: { item: FeedItem }) {
  return (
    <li>
      <details name="story" className="drawer group rounded-xl border border-line">
        <summary className="flex cursor-pointer list-none gap-4 p-5 hover:bg-surface/50 [&::-webkit-details-marker]:hidden">
          <Badge item={item} />
          <div className="min-w-0 flex-1">
            <h2 className="font-medium">{item.title}</h2>
            <p className="mt-1 text-xs text-muted">
              {[item.source, timeAgo(item.published_at), ...item.topics].join(" · ")}
            </p>
            {item.why && (
              <p data-xray="why" className="mt-3 rounded-md bg-surface px-3 py-2 text-sm">
                <span className="font-medium text-accent">Why it matters to you: </span>
                {item.why}
              </p>
            )}
          </div>
          {item.image && <Photo src={item.image} className="h-14 w-14 shrink-0 rounded-md group-open:hidden sm:h-20 sm:w-32" />}
        </summary>

        <div className="grid gap-x-8 gap-y-5 px-5 pb-6 sm:pl-20 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {item.takeaways.length > 0 && (
            <div className="rounded-lg bg-surface p-4 text-sm lg:col-start-2 lg:row-start-1 lg:self-start">
              <p className="text-xs font-medium uppercase tracking-wide text-accent">Key takeaways</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-4">
                {item.takeaways.map((takeaway) => (
                  <li key={takeaway}>{takeaway}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-4 lg:col-start-1 lg:row-start-1">
            {item.image && <Photo src={item.image} className="aspect-video w-full rounded-lg" />}
            {item.description && <p className="text-lg leading-snug">{item.description}</p>}
          </div>

          {item.reading.length > 0
            ? item.reading.map((paragraph, index) => <Passage key={index} paragraph={paragraph} />)
            : item.excerpt.split("\n").map((text, index) => <Passage key={index} paragraph={{ text, gap: false }} />)}

          <div className="flex flex-wrap items-center gap-3 pt-2 lg:col-span-2">
            <AskAbout
              story={{ id: item.id, title: item.title }}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            />
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:border-accent"
            >
              Read the full story at {item.source} ↗
            </a>
            {item.author && <span className="text-sm text-muted">By {item.author}</span>}
          </div>
        </div>
      </details>
    </li>
  );
}

// One paragraph of the article, with its key passage marked and Signal's note beside it (below it
// on narrow screens), joined by a short line across the column gap.
function Passage({ paragraph: { text, gap, mark, note } }: { paragraph: Paragraph }) {
  return (
    <>
      <div className="lg:col-start-1">
        {gap && <p className="mb-5 text-center tracking-[0.5em] text-muted">···</p>}
        <p className="leading-relaxed">
          {mark ? (
            <>
              {text.slice(0, mark[0])}
              <mark className="rounded bg-accent/15 px-0.5 text-foreground">{text.slice(mark[0], mark[1])}</mark>
              {text.slice(mark[1])}
            </>
          ) : (
            text
          )}
        </p>
      </div>
      {note && (
        <p className="relative -mt-2 border-l-2 border-accent pl-3 text-sm lg:mt-0 lg:self-center lg:border-0 lg:pl-0 lg:before:absolute lg:before:top-2.5 lg:before:right-full lg:before:mr-2 lg:before:h-px lg:before:w-6 lg:before:bg-accent">
          <span className="font-medium text-accent">Signal: </span>
          {note}
        </p>
      )}
    </>
  );
}

// Photos load straight from the publisher, lazily. next/image would have to allow every host,
// which would turn the image optimizer into an open proxy.
function Photo({ src, className }: { src: string; className: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className={`bg-surface object-cover ${className}`} />
  );
}

// A score, or why there isn't one: the quick check said it's not a match, or it hasn't been checked yet.
function Badge({ item }: { item: FeedItem }) {
  const label = { scored: String(item.score), "no-match": "No match", pending: "…" }[item.status];
  return (
    <span
      data-xray="score"
      title={item.status === "pending" ? "Not scored yet" : undefined}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface text-center ${
        item.status === "scored" ? "font-semibold" : "text-[10px] leading-tight text-muted"
      }`}
    >
      {label}
    </span>
  );
}
