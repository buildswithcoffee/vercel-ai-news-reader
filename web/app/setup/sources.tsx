"use client";

import { useState, type CSSProperties } from "react";
import type { Source } from "@/lib/db";
import { hue } from "@/lib/hue";

// The sources Signal scans, as rows you switch on and off, with a search across them. Every row
// stays in the form while hidden by the search, so saving keeps the ones you can't see.
export function Sources({ sources }: { sources: Source[] }) {
  const [query, setQuery] = useState("");
  const [on, setOn] = useState(() => new Set(sources.filter((source) => source.enabled).map((source) => source.name)));
  const matches = (source: Source) =>
    `${source.name} ${source.kind} ${site(source.url)}`.toLowerCase().includes(query.trim().toLowerCase());
  const kinds = Map.groupBy(sources, (source) => source.kind);

  function toggle(name: string, checked: boolean) {
    const next = new Set(on);
    if (checked) next.add(name);
    else next.delete(name);
    setOn(next);
  }

  return (
    <section className="mt-10 rounded-xl border border-line">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line p-5">
        <div>
          <h2 className="font-medium">Sources</h2>
          <p className="mt-1 text-sm text-muted">
            {on.size} of {sources.length} on. New sources show up with the next scan, within 15 minutes.
          </p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && event.preventDefault()} // don't submit the form
          placeholder="Search sources"
          aria-label="Search sources"
          className="w-full rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent sm:w-56"
        />
      </div>

      <div className="space-y-5 p-3 sm:p-4">
        {[...kinds].map(([kind, group]) => (
          <div key={kind} hidden={!group.some(matches)}>
            <p className="px-3 pb-1 text-xs font-medium text-muted">{kind}</p>
            <div className="grid sm:grid-cols-2">
              {group.map((source) => (
                <label
                  key={source.name}
                  hidden={!matches(source)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-surface"
                >
                  <Logo source={source} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{source.name}</span>
                    <span className="block truncate text-xs text-muted">{site(source.url)}</span>
                  </span>
                  <input
                    type="checkbox"
                    name="source"
                    value={source.name}
                    defaultChecked={source.enabled}
                    onChange={(event) => toggle(source.name, event.target.checked)}
                    className="peer sr-only"
                  />
                  {/* A switch: the track turns accent and the knob slides over when it's on. */}
                  <span
                    aria-hidden
                    className="relative h-5 w-9 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-4 peer-checked:after:bg-background"
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
        {!sources.some(matches) && <p className="px-3 py-6 text-center text-sm text-muted">No sources match “{query}”.</p>}
      </div>
    </section>
  );
}

// The site a source's feed lives on, without a feeds. or www. prefix: feeds.arstechnica.com is arstechnica.com.
function site(url: string) {
  return new URL(url).hostname.replace(/^(feeds|www)\./, "");
}

// The site's own icon, through Google's favicon service. Sites without one get a colored initial.
function Logo({ source }: { source: Source }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        aria-hidden
        className="tint flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold"
        style={{ "--hue": hue(source.name) } as CSSProperties}
      >
        {source.name[0]}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${site(source.url)}&sz=64`}
      alt=""
      width={28}
      height={28}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-7 w-7 shrink-0 rounded-md bg-white object-contain p-0.5 ring-1 ring-line"
    />
  );
}
