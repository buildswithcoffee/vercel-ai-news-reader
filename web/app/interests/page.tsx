import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getProfile, saveProfile } from "@/lib/db";
import { requestRescore } from "@/lib/backend";

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

async function save(formData: FormData) {
  "use server";
  const changed = await saveProfile({
    about: String(formData.get("about")).trim(),
    topics: formData.getAll("topic").map(String),
  });
  if (changed) await requestRescore();
  redirect("/");
}

export default async function InterestsPage() {
  await connection(); // read your saved profile at request time, not at build
  const profile = await getProfile();

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">What do you care about?</h1>
      <p className="mt-2 text-muted">Say it in your own words. Signal reads every story with this in mind.</p>

      <form action={save} className="mt-8">
        <textarea
          name="about"
          required
          rows={4}
          defaultValue={profile?.about}
          placeholder="I want to use AI to help my team ship faster, and stay on top of new models worth trying."
          className="w-full rounded-lg border border-line bg-transparent p-3 outline-none focus:border-accent"
        />

        <p className="mt-6 text-sm text-muted">Add topics if you like</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TOPICS.map((topic) => (
            <label key={topic}>
              <input
                type="checkbox"
                name="topic"
                value={topic}
                defaultChecked={profile?.topics.includes(topic)}
                className="peer sr-only"
              />
              <span className="block cursor-pointer rounded-full border border-line px-3.5 py-1.5 text-sm peer-checked:border-accent peer-checked:bg-accent peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                {topic}
              </span>
            </label>
          ))}
        </div>

        <button type="submit" className="mt-8 rounded-md bg-accent px-5 py-2.5 font-medium text-white hover:opacity-90">
          Build my briefing
        </button>
      </form>

    </section>
  );
}
