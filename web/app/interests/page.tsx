import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getInterests, saveInterests } from "@/lib/db";
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
  const { userId } = await auth.protect();
  await saveInterests(userId, formData.getAll("interest").map(String));
  await requestRescore(userId);
  redirect("/feed");
}

export default async function InterestsPage() {
  const { userId } = await auth.protect();
  const current = await getInterests(userId);

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">What do you care about?</h1>
      <p className="mt-2 text-muted">Signal scores every story against these topics.</p>

      <form action={save} className="mt-8">
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((topic) => (
            <label key={topic}>
              <input
                type="checkbox"
                name="interest"
                value={topic}
                defaultChecked={current.includes(topic)}
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
