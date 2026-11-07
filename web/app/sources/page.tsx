import { refresh } from "next/cache";
import { connection } from "next/server";
import { getSources, setSourceEnabled, type Source } from "@/lib/db";

export const metadata = { title: "Sources · Signal" };

async function toggle(formData: FormData) {
  "use server";
  await setSourceEnabled(String(formData.get("name")), formData.get("enabled") === "true");
  refresh();
}

export default async function SourcesPage() {
  await connection(); // read your choices at request time, not at build
  const sources = await getSources();

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
      <p className="mt-2 text-muted">
        Where Signal finds stories. Turn one on and its stories arrive with the next scan, within 15 minutes.
        Turn one off and its stories leave your feed now.
      </p>

      <ul className="mt-8 divide-y divide-line border-y border-line">
        {sources.map((source) => (
          <SourceRow key={source.name} source={source} />
        ))}
      </ul>

    </section>
  );
}

function SourceRow({ source }: { source: Source }) {
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="font-medium">{source.name}</p>
        <p className="text-sm text-muted">{new URL(source.url).hostname.replace(/^www\./, "")}</p>
      </div>
      <form action={toggle}>
        <input type="hidden" name="name" value={source.name} />
        <input type="hidden" name="enabled" value={String(!source.enabled)} />
        <button
          aria-pressed={source.enabled}
          aria-label={`${source.name}: ${source.enabled ? "on" : "off"}`}
          className="w-14 rounded-full border border-line py-1 text-xs text-muted hover:text-foreground aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-white"
        >
          {source.enabled ? "On" : "Off"}
        </button>
      </form>
    </li>
  );
}
