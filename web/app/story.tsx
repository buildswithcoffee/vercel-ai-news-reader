import { Fragment } from "react";
import type { FeedItem } from "@/lib/db";
import { timeAgo } from "@/lib/time";
import { AskAbout } from "./guide";

// Each story opens like a drawer. On the left, the photo and the publisher's summary; then a few
// passages from the article, each with Signal's note beside it. The full article stays at the
// source, one click away.
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
          <div className="space-y-4">
            {item.image && <Photo src={item.image} className="aspect-video w-full rounded-lg" />}
            {item.description && <p className="text-lg leading-snug">{item.description}</p>}
            {item.points.length === 0 && item.excerpt && (
              <p className="line-clamp-6 whitespace-pre-line text-sm text-muted">{item.excerpt}</p>
            )}
          </div>
          <div className="space-y-3 text-sm">
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-md bg-accent px-4 py-2 text-center font-medium text-white hover:opacity-90"
            >
              Read the full story at {item.source}
            </a>
            {item.author && <p className="text-center text-muted">By {item.author}</p>}
            <div className="text-center">
              <AskAbout story={{ id: item.id, title: item.title }} />
            </div>
          </div>

          {item.points.length > 0 && (
            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-accent lg:col-span-2">Key points</p>
          )}
          {item.points.map((point) => (
            <Fragment key={point.quote}>
              <blockquote className="border-l-2 border-accent pl-4 leading-snug">“{point.quote}”</blockquote>
              {/* On wide screens a short line joins each note to its passage, across the column gap. */}
              <p className="relative -mt-3 pl-4 text-sm lg:mt-0 lg:pl-0 lg:before:absolute lg:before:top-2.5 lg:before:right-full lg:before:mr-2 lg:before:h-px lg:before:w-6 lg:before:bg-accent">
                <span className="font-medium text-accent">Signal: </span>
                {point.note}
              </p>
            </Fragment>
          ))}
        </div>
      </details>
    </li>
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
