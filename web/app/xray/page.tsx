import type { CSSProperties, ReactNode } from "react";
import { connection } from "next/server";
import { getFeed, type FeedItem } from "@/lib/db";
import { DEPLOY, REPO, parts, type PartName } from "@/lib/xray";
import { Story } from "../story";
import { Logo } from "../xray";
import { Connectors } from "./connectors";
import { Prompt } from "./prompt";
import { Slides } from "./slides";

export const metadata = { title: "X-ray · Signal" };

// A guided tour of each part of Signal, with notes in the margin on the Vercel product behind it, then
// how to make it your own and how to share it.
// It opens on your real feed, which zooms out while the notes' lines draw in. On narrow screens the
// notes follow the sketch, matched by number.
export default async function XrayPage() {
  await connection(); // your feed as it is right now
  const stories = (await getFeed("relevance", null)).slice(0, 3);
  return (
    // Wider than the other pages, to leave room for the margin notes. The heading, tabs and the boxed
    // slides line up with the other pages (page-column in globals.css).
    <div className="relative left-1/2 w-[min(76rem,calc(100vw-2rem))] -translate-x-1/2">
      <div className="page-column">
        <h1 className="text-2xl font-semibold tracking-tight">X-ray</h1>
        <p className="mt-2 text-muted">
          How Vercel runs Signal, from the feed to the agent to the platform underneath, and how to make one of your own.
        </p>
      </div>
      <Slides titles={["The feed", "The agent", "Vercel Platform", "Make it your own", "Share"]}>
        <FeedSlide stories={stories} />
        <AgentSlide />
        <PlatformSlide />
        <OwnSlide />
        <ShareSlide />
      </Slides>
    </div>
  );
}

// Your real feed, zoomed out, with the Vercel product behind each part around it.
function FeedSlide({ stories }: { stories: FeedItem[] }) {
  return (
    <Tour
      zoom
      left={
        <>
          <Note n={1} part="web" to="brand">
            This page renders on the server for every request and checks for new scores every 5 seconds.
          </Note>
          <Note n={2} part="gateway" to="score">
            An LLM read the whole article and scored it against your own words, through AI Gateway. The scorer signs
            in with its deployment&apos;s OIDC token, so there&apos;s no API key.
          </Note>
        </>
      }
      right={
        <>
          <Note n={3} part="neon" to="sort">
            Ranking by relevance is one query against Neon Postgres, where every story, score, and setting lives.
          </Note>
          <Note n={4} part="queue" to="why">
            Change your interests and every note is rewritten: a private Python service queues the rescore, so your
            save returns right away.
          </Note>
          <Note n={5} part="daemon" to="feed">
            An always-on Python worker keeps the whole feed fresh. Every 15 minutes it reads each new article, keeps
            the ones a built-in embedding model says match you, and scores those.
          </Note>
        </>
      }
    >
      <div className="flex items-center justify-between gap-3">
        <Target n={1} name="brand">
          <span className="font-semibold tracking-tight">Signal</span>
        </Target>
        <Target n={3} name="sort">
          <span className="block rounded-md bg-surface p-0.5 text-xs">
            <span className="inline-block rounded bg-background px-2 py-1 shadow-sm">Most relevant</span>
            <span className="inline-block px-2 py-1 text-muted">Latest</span>
          </span>
        </Target>
      </div>
      {/* The real stories, outlined where the notes point. Inert: this is a picture of the feed. */}
      <div data-xray="feed" data-region inert className="xray-feed mt-4">
        {stories.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-8 text-center text-muted">Scanning the news…</p>
        ) : (
          <ol className="space-y-3">
            {stories.map((item) => (
              <Story key={item.id} item={item} />
            ))}
          </ol>
        )}
      </div>
    </Tour>
  );
}

function AgentSlide() {
  return (
    <Tour
      left={
        <>
          <Note n={1} part="agent" to="chat">
            Ask Signal is an eve agent. Its instructions, its tools, and its chat channel are files in agent/,
            deployed as its own service in this project.
          </Note>
          <Note n={2} part="sandbox" to="tool">
            Its tools only read: Vercel&apos;s docs and the stories in your feed. Give an eve agent tools that run
            code, and on Vercel each conversation gets its own isolated sandbox.
          </Note>
          <Note n={3} part="gateway" to="answer">
            Answers come from Claude Sonnet 5.5 through the same AI Gateway the scorer uses, with a spending cap on
            every conversation.
          </Note>
        </>
      }
      right={
        <Note n={4} part="workflow" to="conversation">
          Each conversation is a durable workflow. If the server restarts or you redeploy mid-answer, it resumes where
          it left off.
        </Note>
      }
    >
      <Target n={1} name="chat">
        <span className="font-semibold tracking-tight">Ask Signal</span>
      </Target>
      <Target n={4} name="conversation" region>
        <div className="mt-4 space-y-3 pb-1">
          <p className="play-in ml-auto w-fit max-w-[85%] rounded-lg bg-accent px-3 py-2 text-background" style={at(0.2)}>
            How does Signal keep scoring when no one&apos;s looking?
          </p>
          <div className="play-in" style={at(0.9)}>
            <Target n={2} name="tool">
              <p className="text-xs text-muted">Reading vercel.com/docs/daemons…</p>
            </Target>
          </div>
          <div className="grid [&>*]:[grid-area:1/1]">
            <p className="play-typing w-fit rounded-lg bg-surface px-3 py-2 tracking-widest" style={at(1.3, 1.2)}>
              •••
            </p>
            <Target n={3} name="answer" className="play-in max-w-[85%]" style={at(2.5)}>
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
          <Note n={1} part="cdn" to="traffic">
            Every request lands on Vercel&apos;s global network first, and the Firewall filters bad traffic before it
            reaches the app.
          </Note>
          <Note n={2} part="services" to="services">
            The site, a private Python API, the agent, and the scorer, side by side. They reach each other through
            service bindings, with no public URLs or keys between them.
          </Note>
          <Note n={3} part="api" to="rescore">
            Save new interests and the web app calls a FastAPI service through its binding. It has no public URL, so
            only the web app can reach it, and it hands the rescore to a queue.
          </Note>
        </>
      }
      right={
        <>
          <Note n={4} part="previews" to="status">
            One git push builds and deploys all four together. Every pull request gets its own preview, with its own
            copy of the database.
          </Note>
          <Note n={5} part="observability" to="logs">
            Logs from all four land in one place, and every conversation with the agent is traced in Agent Runs.
          </Note>
        </>
      }
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold tracking-tight">signal · Production</span>
        <Target n={4} name="status">
          <span className="text-xs text-muted">
            <span className="text-green-600">●</span> Ready · main
          </span>
        </Target>
      </div>
      <div className="mt-4">
        <Target n={1} name="traffic">
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
        <Target n={2} name="services">
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
        <Target n={3} name="rescore">
          <span className="flex flex-wrap items-center gap-2 text-xs">
            {["Save interests", "web", "api", "Queue", "scorer"].map((step, index) => (
              <span key={step} className="flex items-center gap-2">
                {index > 0 && <span className="text-muted">→</span>}
                <span className={`rounded-md border px-2 py-1 ${step === "api" ? "border-accent" : "border-line"}`}>{step}</span>
              </span>
            ))}
          </span>
        </Target>
      </div>
      <div className="mt-4">
        <Target n={5} name="logs">
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

// An invitation to build on Signal: how a change ships, from your coding agent to a pull request to
// production, and three features to try, each with a prompt to hand your agent.
const BUILD_STEPS = [
  {
    title: "Get the code",
    text: "Deploy your own copy from Share, then have your coding agent bring it down to your computer.",
    prompt: "Clone my Signal repo from GitHub to my desktop, install its dependencies, and run `vercel link` to connect it to my Vercel project.",
  },
  {
    title: "Ask for a feature",
    text: "Describe what you want in plain words. Ask for a branch and a pull request, so nothing reaches production until you've tried it.",
    prompt: "Add [your feature]. Work on a new branch, commit as you go, and open a pull request when it's ready.",
  },
  {
    title: "See it, then ship it",
    text: "Vercel builds every pull request into its own preview, with all four services and its own copy of the database. Try it there, then merge, and production updates.",
  },
];

const IDEAS = [
  {
    title: "A morning email",
    text: "Your five strongest stories in your inbox at 8am.",
    uses: ["Resend", "Cron Jobs", "Vercel Flags"],
    prompt: "Add a morning email: every day at 8am, send me my five highest-scoring stories from the last day, each with its why-it-matters line. Use Resend from the Vercel Marketplace for the email and a Vercel cron job for the schedule, and put it behind a Vercel flag. Work on a new branch, commit, and open a pull request.",
  },
  {
    title: "Ask Signal in Slack",
    text: "Mention Signal in a channel and ask about today's news.",
    uses: ["eve", "Vercel Connect"],
    prompt: "Add a Slack channel to the Ask Signal agent in agent/ with `eve add channel/slack`, so my team can mention it in Slack and ask about stories in the feed. Keep the web chat as it is. Work on a new branch, commit, and open a pull request.",
  },
  {
    title: "What's heating up",
    text: "A weekly chart of which of your topics are rising.",
    uses: ["Next.js", "Neon Postgres"],
    prompt: "Add a Trends page that charts, week by week for the last eight weeks, how many strong stories (scored 80 or more) each of my topics had, using the scores already in Postgres. Link it from the nav. Work on a new branch, commit, and open a pull request.",
  },
];

function OwnSlide() {
  return (
    <div className="page-column rounded-xl border border-line p-6 sm:p-10">
      <h2 className="font-serif text-3xl font-medium tracking-tight">Build on Signal</h2>
      <p className="mt-2 max-w-2xl text-muted">
        Signal is a starting point. Add what you wish it did: your coding agent writes the change, and Vercel ships it
        the same way every part of Signal shipped.
      </p>

      <ol className="mt-8 grid gap-4 lg:grid-cols-3">
        {BUILD_STEPS.map((step, index) => (
          <li key={step.title} className="rounded-lg border border-line p-4 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Number n={index + 1} />
              {step.title}
            </p>
            <p className="mt-2 text-muted">{step.text}</p>
            {step.prompt && <Prompt text={step.prompt} />}
          </li>
        ))}
      </ol>

      <h3 className="mt-10 font-medium">Three ideas to try</h3>
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        {IDEAS.map((idea) => (
          <div key={idea.title} className="flex flex-col rounded-lg border border-dashed border-line p-4 text-sm">
            <p className="font-serif text-lg font-medium">{idea.title}</p>
            <p className="mt-1 text-muted">{idea.text}</p>
            <p className="mt-2 flex flex-wrap gap-1.5">
              {idea.uses.map((product) => (
                <span key={product} className="rounded-full border border-line px-2 py-0.5 text-xs">
                  {product}
                </span>
              ))}
            </p>
            <div className="mt-auto">
              <Prompt text={idea.prompt} />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 max-w-3xl text-sm text-muted">
        Your Signal stays yours: your{" "}
        <a href={parts.env.href} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
          PROFILE_EDIT_KEY
        </a>{" "}
        is its password, and it stays private until you turn on the{" "}
        <a href={parts.flags.href} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
          public-access flag
        </a>
        . On a team,{" "}
        <a href={parts.protection.href} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
          Vercel Authentication
        </a>{" "}
        can guard the whole app too.
      </p>
    </div>
  );
}

// Hand Signal to someone: a QR code for the repo, and a button that deploys a copy of their own.
// public/share-qr.svg encodes REPO; regenerate it with `pnpm dlx qrcode -t svg -o public/share-qr.svg <url>`.
function ShareSlide() {
  const steps = [
    "Press Deploy. Vercel copies the repo into your GitHub account, creates a Vercel project for it, and sets up a Neon database.",
    "When it asks, choose a PROFILE_EDIT_KEY: any password of 32 or more characters. It's how you sign in.",
    "Open your new Signal, sign in, and pick your interests and sources in Setup. Stories arrive within 15 minutes.",
  ];
  return (
    <div className="page-column grid grid-cols-[minmax(0,1fr)] items-center gap-10 rounded-xl border border-line p-6 sm:p-10 lg:grid-cols-[auto_minmax(0,1fr)]">
      <div className="mx-auto max-w-52 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/share-qr.svg" alt={`QR code for ${REPO}`} width={208} height={208} className="rounded-lg bg-white" />
        <a href={REPO} target="_blank" rel="noreferrer" className="mt-3 block text-sm break-all hover:underline">
          {REPO.replace("https://", "")}
        </a>
      </div>
      <div>
        <h2 className="font-serif text-3xl font-medium tracking-tight">Get your own Signal</h2>
        <ol className="mt-5 space-y-3">
          {steps.map((step, index) => (
            <li key={index} className="flex gap-3">
              <Number n={index + 1} className="mt-0.5" />
              <p className="text-sm">{step}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href={DEPLOY} target="_blank" rel="noreferrer" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90">
            ▲ Deploy to Vercel
          </a>
          <a href={REPO} target="_blank" rel="noreferrer" className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:border-accent">
            View on GitHub ↗
          </a>
        </div>
        <p className="mt-6 text-sm text-muted">
          Rather start from the code? Run <code className="font-mono break-all text-foreground">git clone {REPO}</code>, then{" "}
          <code className="font-mono text-foreground">vercel</code> in the folder to create the project, and add Neon from
          the Vercel Marketplace.
        </p>
      </div>
    </div>
  );
}

// The sketch in the middle, notes on either side, and lines between them on wide screens. With
// `zoom`, the sketch starts full size and zooms out into place when the slide comes into view.
function Tour({ left, right, zoom = false, children }: {
  left: ReactNode;
  right: ReactNode;
  zoom?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative grid grid-cols-[minmax(0,1fr)] gap-8 pb-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)_minmax(0,1fr)] lg:gap-x-20">
      <div className="space-y-8 lg:self-center">{left}</div>
      <div
        className={`order-first self-start rounded-xl border border-line bg-background p-4 text-sm lg:order-none lg:self-center ${
          zoom ? "xray-zoom" : ""
        }`}
      >
        {children}
      </div>
      <div className="space-y-8 lg:self-center">{right}</div>
      <Connectors />
    </div>
  );
}

// Outlines the part of the sketch a note points to. A region is a whole area, like the feed.
function Target({ n, name, region = false, className = "", style, children }: {
  n: number;
  name: string;
  region?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      style={style}
      data-xray={name}
      data-region={region || undefined}
      className={`relative rounded outline-offset-2 ${region ? "" : "h-fit w-fit max-w-full outline-1 outline-accent outline-dashed"} ${className}`}
    >
      {children}
      <Number n={n} className={`absolute -top-2 ${region ? "-right-2" : "-left-2"}`} />
    </div>
  );
}

// A margin note, pointing at the target with the same name.
function Note({ n, part, to, children }: { n: number; part: PartName; to: string; children: ReactNode }) {
  return (
    <div data-note={to} className="xray-note text-sm lg:max-w-72">
      <Logo part={part} />
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
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-background ${className}`}
    >
      {n}
    </span>
  );
}

// When an element of the mock chat appears, and for how long, once its slide is in view.
function at(seconds: number, lasts = 0) {
  return { "--at": `${seconds}s`, "--for": `${lasts}s` } as CSSProperties;
}
