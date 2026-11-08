import { refresh } from "next/cache";
import { EXCERPT_CHARS, addFollowUp, type FeedItem, type Paragraph } from "@/lib/db";
import { followUpsFlag } from "@/flags";
import { timeAgo } from "@/lib/time";
import { AskAbout } from "./guide";

// Each story opens like a drawer: the rest of why it matters and its key takeaways, the photo and
// the publisher's summary, then the opening of the article and each paragraph Signal flagged, with
// its note in the margin. The rest of the article stays at the source, one click away.
const FOLLOW_UPS = ["Tell my team about this", "Read the full story later", "Bring this up in our next meeting"];

async function followUp(formData: FormData) {
  "use server";
  if (!(await followUpsFlag())) throw new Error("Follow-ups are turned off");
  await addFollowUp(String(formData.get("article")), String(formData.get("preset") ?? formData.get("task") ?? ""));
  refresh();
}

// `followUps`: show the follow-up action. The page passes it when the flag is on and you're signed in.
export function Story({ item, followUps = false }: { item: FeedItem; followUps?: boolean }) {
  const hasMore = Boolean(item.detail) || item.takeaways.length > 0;
  return (
    <li>
      <details name="story" className="drawer group rounded-xl border border-line">
        <summary
          className={`flex cursor-pointer list-none gap-4 p-5 hover:bg-surface/50 [&::-webkit-details-marker]:hidden ${
            hasMore ? "group-open:pb-0" : ""
          }`}
        >
          <Badge item={item} />
          <div className="min-w-0 flex-1">
            <h2 className="font-medium">{item.title}</h2>
            <p className="mt-1 text-xs text-muted">
              {[
                item.source,
                timeAgo(item.published_at),
                item.coverage ? `via ${item.coverage.source}` : item.headlineOnly ? "Headline only" : null,
                ...item.topics,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {item.why && (
              <p
                data-xray="why"
                className={`mt-3 rounded-md bg-surface px-3 py-2 text-sm ${hasMore ? "group-open:rounded-b-none" : ""}`}
              >
                <span className="font-medium text-accent">Why it matters to you: </span>
                {item.why}
              </p>
            )}
          </div>
          {item.image && <Photo src={item.image} className="h-14 w-14 shrink-0 rounded-md group-open:hidden sm:h-20 sm:w-32" />}
        </summary>

        <div className="grid gap-x-8 gap-y-5 px-5 pb-6 sm:pl-20 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {/* The rest of "why it matters" continues the box on the card, so it reads as one block. */}
          {hasMore && (
            <div className="space-y-3 rounded-b-md bg-surface px-3 pt-1 pb-3 text-sm lg:col-span-2">
              {item.detail && <p>{item.detail}</p>}
              {item.takeaways.length > 0 && (
                <ul className="list-disc space-y-1 pl-4">
                  {item.takeaways.map((takeaway) => (
                    <li key={takeaway}>{takeaway}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {item.headlineOnly && (
            <p className="text-sm text-muted lg:col-span-2">
              {item.coverage
                ? `Signal can't read this page, so this comes from ${item.coverage.source}'s coverage of the same news.`
                : "Signal can't read this page, so it only has the headline and summary."}
            </p>
          )}
          {/* The publisher's subtitle and byline under the headline, then the photo, as a news page lays them out. */}
          {(item.description || item.author) && (
            <div className="space-y-1 lg:col-span-2">
              {item.description && <p className="text-lg leading-snug">{item.description}</p>}
              {item.author && <p className="text-sm text-muted">By {item.author}</p>}
            </div>
          )}
          {item.image && <Photo src={item.image} className="aspect-[2/1] w-full rounded-lg lg:col-span-2" />}

          {(item.reading.length > 0 ? item.reading : opening(item.excerpt)).map((paragraph, index) => (
            <Passage key={index} paragraph={paragraph} />
          ))}

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
            {item.coverage && (
              <a href={item.coverage.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-accent hover:underline">
                {item.coverage.source}&apos;s coverage ↗
              </a>
            )}
          </div>

          {followUps && (
            <form action={followUp} className="flex flex-wrap items-center gap-2 border-t border-line pt-4 text-sm lg:col-span-2">
              <input type="hidden" name="article" value={item.id} />
              <span className="text-muted">Follow up:</span>
              <input
                name="task"
                maxLength={200}
                placeholder="Write your own"
                className="min-w-40 flex-1 rounded-md border border-line bg-transparent px-3 py-1.5 outline-none focus:border-accent"
              />
              {/* Before the presets, so pressing Enter in the field adds what you typed. */}
              <button className="rounded-md border border-line px-3 py-1.5 font-medium hover:border-accent">Add</button>
              <span className="text-muted">or</span>
              {FOLLOW_UPS.map((preset) => (
                <button key={preset} name="preset" value={preset} className="rounded-full border border-line px-3 py-1.5 hover:border-accent">
                  {preset}
                </button>
              ))}
            </form>
          )}
        </div>
      </details>
    </li>
  );
}

// The excerpt as whole paragraphs: drop the last one if the excerpt cut it off.
function opening(excerpt: string): Paragraph[] {
  const paragraphs = excerpt.split("\n").filter((text) => text.trim());
  if (excerpt.length >= EXCERPT_CHARS && paragraphs.length > 1) paragraphs.pop();
  return paragraphs.map((text) => ({ text, gap: false }));
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
