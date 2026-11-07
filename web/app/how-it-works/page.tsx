import { parts, type PartName } from "@/lib/xray";
import { Xray } from "../xray";

export const metadata = { title: "How it works · Signal" };

const STEPS: { text: string; part: PartName }[] = [
  { text: "Every 15 minutes, the scorer scans Hacker News and tech blogs and reads each new article.", part: "daemon" },
  { text: "It saves each article to Postgres.", part: "neon" },
  { text: "A small embedding model keeps the articles that match your interests, and an LLM scores them and says why they matter.", part: "gateway" },
  { text: "The feed renders on the server and checks for new scores every 5 seconds.", part: "web" },
  { text: "When you change your interests, the web app calls the private Python service…", part: "api" },
  { text: "…which queues a rescore for the scorer to pick up.", part: "queue" },
];

export default function HowItWorksPage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">How Signal works</h1>
      <p className="mt-2 text-muted">
        One Vercel project: a Next.js app, a private Python API, an always-on Python worker, an AI agent, and
        a Postgres database, all deployed together from one git push.
      </p>

      <h2 className="mt-10 font-medium">The life of a story</h2>
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

      <h2 className="mt-10 font-medium">The parts</h2>
      <Xray always show={Object.keys(parts) as PartName[]} />
    </section>
  );
}
