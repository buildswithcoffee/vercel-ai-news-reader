import { refresh } from "next/cache";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { deleteFollowUp, getFollowUps, setFollowUpDone, type FollowUp } from "@/lib/db";
import { followUpsFlag } from "@/flags";

export const metadata = { title: "Follow-ups · Signal" };

async function toggle(formData: FormData) {
  "use server";
  if (!(await followUpsFlag())) notFound();
  await setFollowUpDone(String(formData.get("id")), formData.get("done") === "true");
  refresh();
}

async function remove(formData: FormData) {
  "use server";
  if (!(await followUpsFlag())) notFound();
  await deleteFollowUp(String(formData.get("id")));
  refresh();
}

export default async function FollowUpsPage() {
  await connection();
  if (!(await followUpsFlag())) notFound();
  const followUps = await getFollowUps();

  return (
    <section className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Follow-ups</h1>
      <p className="mt-2 text-muted">Things you meant to do about a story. Add one from any open story.</p>
      {followUps.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-line p-10 text-center text-muted">Nothing to follow up on.</p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {followUps.map((followUp) => (
            <Row key={followUp.id} followUp={followUp} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({ followUp: { id, task, done, title, url, source } }: { followUp: FollowUp }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <form action={toggle}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="done" value={String(!done)} />
        <button
          aria-label={done ? "Mark as not done" : "Mark as done"}
          aria-pressed={done}
          className="mt-0.5 flex h-5 w-5 items-center justify-center rounded border border-line text-xs text-white hover:border-accent aria-pressed:border-accent aria-pressed:bg-accent"
        >
          {done && "✓"}
        </button>
      </form>
      <div className="min-w-0 flex-1">
        <p className={done ? "text-muted line-through" : ""}>{task}</p>
        <a href={url} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-xs text-muted hover:text-accent">
          {title} · {source}
        </a>
      </div>
      <form action={remove}>
        <input type="hidden" name="id" value={id} />
        <button aria-label="Delete" className="text-muted hover:text-foreground">×</button>
      </form>
    </li>
  );
}
