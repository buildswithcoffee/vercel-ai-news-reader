import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getProfile, getSources, saveProfile, setEnabledSources } from "@/lib/db";
import { OWNER_COOKIE } from "@/lib/profile-owner";
import { requestRescore } from "@/lib/backend";
import { parts, type PartName } from "@/lib/xray";
import { Sources } from "./sources";

export const metadata = { title: "Setup · Signal" };

const TOPICS = [
  "AI agents",
  "LLM pricing",
  "GPUs and chips",
  "Developer tools",
  "Vercel and Next.js",
  "Open-source models",
  "AI regulation",
  "Startup funding",
  "Security",
  "Robotics",
];

// What happens to each story once you've saved, and the part of Vercel behind each step.
const STEPS: { text: string; part: PartName }[] = [
  { text: "Every 15 minutes, the scorer scans the sources you turned on and reads each new article.", part: "daemon" },
  { text: "It saves each article to Postgres.", part: "neon" },
  { text: "A small embedding model keeps the articles that match your interests, and an LLM scores them and says why they matter.", part: "gateway" },
  { text: "The feed renders on the server and checks for new scores every 5 seconds.", part: "web" },
  { text: "When you change your interests, the web app calls the private Python service…", part: "api" },
  { text: "…which queues a rescore for the scorer to pick up.", part: "queue" },
];

// Sources apply right away. A change to your interests also rescores recent stories, and those
// changes are limited to one every 15 minutes, so a sources-only save never waits on that.
async function save(formData: FormData) {
  "use server";
  await setEnabledSources(formData.getAll("source").map(String));
  let changed = false;
  try {
    changed = await saveProfile({
      about: String(formData.get("about")).trim(),
      topics: formData.getAll("topic").map(String),
    });
  } catch {
    redirect("/setup?wait=1");
  }
  if (changed) await requestRescore();
  redirect("/");
}

async function signOut() {
  "use server";
  (await cookies()).delete(OWNER_COOKIE);
  redirect("/");
}

export default async function SetupPage({ searchParams }: PageProps<"/setup">) {
  await connection(); // read your saved choices at request time, not at build
  const [profile, sources, { wait }] = await Promise.all([getProfile(), getSources(), searchParams]);

  return (
    <section className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Setup</h1>
      <p className="mt-2 text-muted">What you care about, and where Signal looks for it.</p>
      {wait && (
        <p className="mt-4 rounded-lg bg-surface px-4 py-3 text-sm">
          Your sources are saved. Your interests weren&apos;t: they can change once every 15 minutes.
        </p>
      )}

      <form action={save} className="mt-8">
        <h2 className="font-medium">What do you care about?</h2>
        <p className="mt-1 text-sm text-muted">Say it in your own words. Signal reads every story with this in mind.</p>
        <textarea
          name="about"
          required
          maxLength={2000}
          rows={4}
          defaultValue={profile?.about}
          placeholder="I want to use AI to help my team ship faster, and stay on top of new models worth trying."
          className="mt-3 w-full rounded-lg border border-line bg-transparent p-3 outline-none focus:border-accent"
        />

        <h2 className="mt-8 font-medium">Topics</h2>
        <Chips name="topic" options={TOPICS.map((topic) => [topic, profile?.topics.includes(topic) ?? false])} />

        <Sources sources={sources} />

        <button type="submit" className="mt-10 rounded-md bg-accent px-5 py-2.5 font-medium text-background hover:opacity-90">
          Update my feed
        </button>
      </form>

      <form action={signOut} className="mt-6">
        <button className="text-sm text-muted hover:text-foreground">Sign out</button>
      </form>

      <h2 className="mt-16 font-medium">How Signal works</h2>
      <p className="mt-1 text-sm text-muted">
        One Vercel project: a Next.js app, a private Python API, an always-on Python worker, an AI agent, and a
        Postgres database, all deployed together from one git push.
      </p>
      <ol className="mt-4 space-y-3">
        {STEPS.map((step, index) => (
          <li key={index} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs">
              {index + 1}
            </span>
            <p>
              {step.text} <span className="text-sm text-accent">{parts[step.part].name}</span>
            </p>
          </li>
        ))}
      </ol>
      <a href="/xray" className="mt-6 inline-block text-sm text-accent hover:underline">
        See every part in X-ray →
      </a>
    </section>
  );
}

// Checkboxes styled as pills. Each checked one is submitted under `name`.
function Chips({ name, options }: { name: string; options: [string, boolean][] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map(([value, checked]) => (
        <label key={value}>
          <input type="checkbox" name={name} value={value} defaultChecked={checked} className="peer sr-only" />
          <span className="block cursor-pointer rounded-full border border-line px-3.5 py-1.5 text-sm peer-checked:border-accent peer-checked:bg-accent peer-checked:text-background peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
            {value}
          </span>
        </label>
      ))}
    </div>
  );
}
