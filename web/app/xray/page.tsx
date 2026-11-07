import type { CSSProperties, ReactNode } from "react";
import { parts, type PartName } from "@/lib/xray";
import { Connectors } from "./connectors";
import { Slides } from "./slides";

export const metadata = { title: "X-ray · Signal" };

// A guided tour: a sketch of each part of Signal, with notes in the margin on the Vercel product
// behind it. On narrow screens the notes follow the sketch, matched by number.
export default function XrayPage() {
  return (
    // Wider than the other pages, to leave room for the margin notes.
    <div className="relative left-1/2 w-[min(76rem,calc(100vw-2rem))] -translate-x-1/2">
      <h1 className="text-2xl font-semibold tracking-tight">X-ray</h1>
      <p className="mt-2 text-muted">How Vercel runs Signal, from the feed to the agent to the platform underneath.</p>
      <Slides titles={["The feed", "The guide", "The platform"]}>
        <FeedSlide />
        <GuideSlide />
        <PlatformSlide />
      </Slides>
    </div>
  );
}

function FeedSlide() {
  return (
    <Tour
      left={
        <>
          <Note n={1} part="web">
            This page renders on the server for every request and checks for new scores every 5 seconds.
          </Note>
          <Note n={2} part="gateway">
            An LLM read the whole article and scored it against your own words, through AI Gateway. The scorer signs
            in with its deployment&apos;s OIDC token, so there&apos;s no API key.
          </Note>
        </>
      }
      right={
        <>
          <Note n={3} part="neon">
            Ranking by relevance is one query against Neon Postgres, where every story, score, and setting lives.
          </Note>
          <Note n={4} part="queue">
            Change your interests and every note is rewritten: a private Python service queues the rescore, so your
            save returns right away.
          </Note>
          <Note n={5} part="daemon">
            An always-on Python worker keeps the whole feed fresh. Every 15 minutes it reads each new article, keeps
            the ones a built-in embedding model says match you, and scores those.
          </Note>
        </>
      }
    >
      <div className="flex items-center justify-between gap-3">
        <Target n={1}>
          <span className="font-semibold tracking-tight">Signal</span>
        </Target>
        <Target n={3}>
          <span className="block rounded-md bg-surface p-0.5 text-xs">
            <span className="inline-block rounded bg-background px-2 py-1 shadow-sm">Most relevant</span>
            <span className="inline-block px-2 py-1 text-muted">Latest</span>
          </span>
        </Target>
      </div>
      <Target n={5} region>
        <div className="mt-4 space-y-3">
          <MockStory
            score="92"
            title="How one retailer put AI agents in front of customers, safely"
            source="TechCrunch · 2h ago"
            why="You want to deploy AI safely at work, and this walks through the guardrails a real company used."
            notes={{ score: 2, why: 4 }}
          />
          <MockStory
            score="81"
            title="A new open-weight model tops coding benchmarks"
            source="Hugging Face · 5h ago"
            why="A model worth trying for your team's internal tools."
          />
          <MockStory
            score="64"
            title="What changed in this week's AI tool updates"
            source="Hacker News · 8h ago"
            why="Quick product updates from tools you might already use."
          />
          <MockStory score="–" title="A new phone launches with a bigger battery" source="The Verge · 9h ago" />
        </div>
      </Target>
    </Tour>
  );
}

function GuideSlide() {
  return (
    <Tour
      left={
        <>
          <Note n={1} part="agent">
            Ask Signal is an eve agent. Its instructions, its tools, and its chat channel are files in agent/,
            deployed as its own service in this project.
          </Note>
          <Note n={2} part="sandbox">
            Its tools only read: Vercel&apos;s docs and the stories in your feed. Give an eve agent tools that run
            code, and on Vercel each conversation gets its own isolated sandbox.
          </Note>
          <Note n={3} part="gateway">
            Answers come from Claude Sonnet 5.5 through the same AI Gateway the scorer uses, with a spending cap on
            every conversation.
          </Note>
        </>
      }
      right={
        <Note n={4} part="workflow">
          Each conversation is a durable workflow. If the server restarts or you redeploy mid-answer, it resumes where
          it left off.
        </Note>
      }
    >
      <Target n={1}>
        <span className="font-semibold tracking-tight">Ask Signal</span>
      </Target>
      <Target n={4} region>
        <div className="mt-4 space-y-3 pb-1">
          <p className="play-in ml-auto w-fit max-w-[85%] rounded-lg bg-accent px-3 py-2 text-white" style={at(0.2)}>
            How does Signal keep scoring when no one&apos;s looking?
          </p>
          <div className="play-in" style={at(0.9)}>
            <Target n={2}>
              <p className="text-xs text-muted">Reading vercel.com/docs/daemons…</p>
            </Target>
          </div>
          <div className="grid [&>*]:[grid-area:1/1]">
            <p className="play-typing w-fit rounded-lg bg-surface px-3 py-2 tracking-widest" style={at(1.3, 1.2)}>
              •••
            </p>
            <Target n={3} className="play-in max-w-[85%]" style={at(2.5)}>
              <p className="rounded-lg bg-surface px-3 py-2">
                A Vercel Daemon: an always-on Python worker that scans your sources every 15 minutes and scores what
                matches you. It deploys from the same git push as the rest of the app.
              </p>
            </Target>
          </div>
        </div>
      </Target>
    </Tour>
  );
}

function PlatformSlide() {
  const services = [
    ["web", "Next.js"],
    ["api", "Python"],
    ["eve", "Agent"],
    ["scorer", "Daemon"],
  ];
  const logs = [
    ["scorer", "scanned 130 stories, 4 new"],
    ["scorer", "92  How one retailer put AI agents in front of customers"],
    ["eve", "run finished · 1 tool call"],
    ["web", "GET / 200"],
  ];
  return (
    <Tour
      left={
        <>
          <Note n={1} part="cdn">
            Every request lands on Vercel&apos;s global network first, and the Firewall filters bad traffic before it
            reaches the app.
          </Note>
          <Note n={2} part="services">
            The site, a private Python API, the agent, and the scorer, side by side. They reach each other through
            service bindings, with no public URLs or keys between them.
          </Note>
        </>
      }
      right={
        <>
          <Note n={3} part="previews">
            One git push builds and deploys all four together. Every pull request gets its own preview, with its own
            copy of the database.
          </Note>
          <Note n={4} part="observability">
            Logs from all four land in one place, and every conversation with the guide is traced in Agent Runs.
          </Note>
        </>
      }
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold tracking-tight">signal · Production</span>
        <Target n={3}>
          <span className="text-xs text-muted">
            <span className="text-green-600">●</span> Ready · main
          </span>
        </Target>
      </div>
      <div className="mt-4">
        <Target n={1}>
          <span className="flex flex-wrap items-center gap-2 text-xs">
            {["Visitors", "Global CDN", "Firewall", "web"].map((step, index) => (
              <span key={step} className="flex items-center gap-2">
                {index > 0 && <span className="text-muted">→</span>}
                <span className="rounded-md border border-line px-2 py-1">{step}</span>
              </span>
            ))}
          </span>
        </Target>
      </div>
      <div className="mt-4">
        <Target n={2}>
          <span className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {services.map(([name, kind]) => (
              <span key={name} className="rounded-md border border-line p-2">
                <span className="block font-mono text-xs">{name}</span>
                <span className="block text-xs text-muted">{kind}</span>
              </span>
            ))}
          </span>
        </Target>
      </div>
      <div className="mt-4">
        <Target n={4}>
          <span className="block rounded-md bg-surface p-3 font-mono text-[11px] leading-relaxed">
            {logs.map(([service, line], index) => (
              <span key={index} className="block truncate">
                <span className="text-accent">{service.padEnd(7)}</span>
                {line}
              </span>
            ))}
          </span>
        </Target>
      </div>
    </Tour>
  );
}

// The sketch in the middle, notes on either side, and lines between them on wide screens.
function Tour({ left, right, children }: { left: ReactNode; right: ReactNode; children: ReactNode }) {
  return (
    <div className="relative grid gap-8 pb-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)_minmax(0,1fr)] lg:gap-x-20">
      <div className="space-y-8 lg:self-center">{left}</div>
      <div className="order-first self-start rounded-xl lg:self-center border border-line bg-background p-4 text-sm lg:order-none">
        {children}
      </div>
      <div className="space-y-8 lg:self-center">{right}</div>
      <Connectors />
    </div>
  );
}

// A story as the feed shows it. `notes` outlines its score and "why" for the margin notes.
function MockStory({ score, title, source, why, notes }: {
  score: string;
  title: string;
  source: string;
  why?: string;
  notes?: { score: number; why: number };
}) {
  const outline = (n: number | undefined, children: ReactNode) => (n ? <Target n={n}>{children}</Target> : children);
  return (
    <div className="flex gap-3 rounded-lg border border-line p-3">
      {outline(
        notes?.score,
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface font-semibold">
          {score}
        </span>,
      )}
      <div className="min-w-0">
        <p className="font-medium leading-snug">{title}</p>
        <p className="mt-0.5 text-xs text-muted">{source}</p>
        {why && (
          <div className="mt-2">
            {outline(
              notes?.why,
              <p className="rounded-md bg-surface px-2.5 py-1.5 text-xs">
                <span className="font-medium text-accent">Why it matters to you: </span>
                {why}
              </p>,
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Outlines the part of the sketch a note explains. A region is a whole area, like the feed.
function Target({ n, region = false, className = "", style, children }: {
  n: number;
  region?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      style={style}
      data-target={n}
      data-region={region || undefined}
      className={`relative rounded outline-offset-2 ${region ? "" : "h-fit w-fit outline-1 outline-accent outline-dashed"} ${className}`}
    >
      {children}
      <Number n={n} className={`absolute -top-2 ${region ? "-right-2" : "-left-2"}`} />
    </div>
  );
}

function Note({ n, part, children }: { n: number; part: PartName; children: ReactNode }) {
  return (
    <div data-note={n} className="text-sm lg:max-w-72">
      <p className="flex items-center gap-2 font-medium">
        <Number n={n} />
        {parts[part].name}
      </p>
      <p className="mt-1">{children}</p>
      <p className="mt-1 text-muted">{parts[part].why}</p>
      <a href={parts[part].href} target="_blank" rel="noreferrer" className="mt-1 inline-block text-accent hover:underline">
        Learn more →
      </a>
    </div>
  );
}

function Number({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-white ${className}`}
    >
      {n}
    </span>
  );
}

// When an element of the mock chat appears, and for how long, once its slide is in view.
function at(seconds: number, lasts = 0) {
  return { "--at": `${seconds}s`, "--for": `${lasts}s` } as CSSProperties;
}
