// The Vercel product behind each part of Signal, for X-ray's notes, the steps on Setup, and Ask
// Signal's instructions (agent/instructions.ts). Each part: what it does in Signal, why it's good,
// and where to learn more.

export type Part = {
  name: string;
  what: string; // what it does in Signal; Ask Signal's instructions describe Signal from this
  why: string;
  href: string;
  logo?: { src: string; width: number; height: number }; // from public/logos, black on transparent
};

export const parts = {
  cdn: {
    name: "CDN and Firewall",
    what: "Every request to Signal lands on Vercel's global network first, where the Firewall filters out bad traffic before it reaches the app.",
    why: "Fast everywhere and protected by default, with nothing to set up.",
    href: "https://vercel.com/docs/vercel-firewall",
  },
  web: {
    name: "Next.js on Fluid Compute",
    what: "This page renders on the server for every request, reading straight from Postgres. Saving your interests runs a Server Action, a server function called right from the form.",
    why: "You write React; Vercel runs the server parts on Fluid Compute, which scales with traffic, reuses warm instances, and bills for active CPU, not idle time.",
    href: "https://vercel.com/docs/fluid-compute",
    logo: { src: "/logos/nextjs.png", width: 300, height: 64 },
  },
  neon: {
    name: "Neon Postgres, from the Marketplace",
    what: "Articles, scores, and your interests live in Neon. Adding it from the Vercel Marketplace created the database and set DATABASE_URL for every environment.",
    why: "One click instead of a separate signup, one bill, and every preview deployment gets its own copy of the database.",
    href: "https://vercel.com/marketplace/neon",
  },
  api: {
    name: "A private Python service",
    what: "When you save, the web app calls a FastAPI service in the same project through a service binding. It has no public URL; only the web app can reach it.",
    why: "Use the right language for each job, in one project and one deploy, with no keys to manage between your own services.",
    href: "https://vercel.com/docs/services/bindings",
  },
  queue: {
    name: "Vercel Queues",
    what: "The Python service puts a rescore message on a queue instead of doing the work while you wait.",
    why: "Your save returns instantly, and queued work is delivered even if a worker restarts.",
    href: "https://vercel.com/docs/queues",
  },
  daemon: {
    name: "A Vercel Daemon",
    what: "An always-on Python container scans the news every 15 minutes, reads each article, filters it with an embedding model built into the image, and handles rescore messages.",
    why: "Long-running workers deploy from the same git push as your app, with no separate infrastructure.",
    href: "https://vercel.com/docs/daemons",
  },
  gateway: {
    name: "AI Gateway",
    what: "Relevant articles are scored by an LLM through AI Gateway. The daemon signs in with its deployment's OIDC token, so there's no API key.",
    why: "One endpoint for hundreds of models, with spend tracking, fallbacks, and no provider keys to rotate.",
    href: "https://vercel.com/docs/ai-gateway",
    logo: { src: "/logos/ai-gateway.png", width: 338, height: 64 },
  },
  agent: {
    name: "An eve agent",
    what: "Ask Signal, in the corner of every page, is an eve agent: instructions, tools that read Vercel's docs and the stories in your feed, and a chat channel, all files in agent/. It deploys as its own service in this project.",
    why: "Conversations are durable and survive restarts, every run is traced in Agent Runs, and it ships with the same git push.",
    href: "https://eve.dev/docs",
    logo: { src: "/logos/eve.png", width: 204, height: 64 },
  },
  services: {
    name: "Vercel Services",
    what: "Signal is four services in one project: the Next.js site, a private Python API, the agent, and the scorer daemon.",
    why: "Each part uses the right language for its job, and they all ship together from one git push.",
    href: "https://vercel.com/docs/services",
  },
  workflow: {
    name: "Vercel Workflow",
    what: "Every conversation with the agent runs as a durable workflow that saves its progress at each step.",
    why: "A conversation survives restarts and redeploys and picks up where it left off, with no queue or state store to build.",
    href: "https://vercel.com/docs/workflow",
  },
  sandbox: {
    name: "Vercel Sandbox",
    what: "Signal's agent only reads docs, so it never opens one. Give an eve agent tools that run code, and on Vercel each conversation gets its own sandbox.",
    why: "Code the model writes runs in an isolated VM, away from your app and your data.",
    href: "https://vercel.com/docs/vercel-sandbox",
  },
  observability: {
    name: "Observability",
    what: "Logs from every service land in one place: page renders, the Python API, the scorer's scans, and every agent conversation in Agent Runs.",
    why: "When something breaks you see it across the whole app, without wiring up a logging vendor.",
    href: "https://vercel.com/docs/observability",
  },
  previews: {
    name: "Git and preview deployments",
    what: "Every pull request to this repo gets its own preview URL, with its own database branch, where the team can comment right on the page.",
    why: "Review the real thing before it ships. Merge it and production updates.",
    href: "https://vercel.com/docs/deployments/preview-deployments",
  },
  env: {
    name: "Environment variables",
    what: "PROFILE_EDIT_KEY is Signal's password: a sensitive environment variable that only the server can read. Whoever knows it owns this Signal.",
    why: "Secrets live in the project, encrypted and set per environment, never in the code.",
    href: "https://vercel.com/docs/environment-variables/sensitive-environment-variables",
  },
  flags: {
    name: "Vercel Flags",
    what: "Signal is private until you turn on its public-access flag, which shares it with anyone who has the link. Follow-ups are a flag too.",
    why: "Ship features dark, open them to whoever you choose, and turn them off in seconds, with no redeploy.",
    href: "https://vercel.com/docs/flags",
  },
  protection: {
    name: "Deployment Protection",
    what: "For a Signal on a team, Vercel Authentication or Password Protection can stand in front of the whole app, before any page loads.",
    why: "Lock previews or production to your team in one setting, with no code.",
    href: "https://vercel.com/docs/deployment-protection",
  },
} satisfies Record<string, Part>;

// The repo, and a link that copies it into your GitHub and deploys it as a new Vercel project, with a
// Neon database and a prompt for your PROFILE_EDIT_KEY. The README's Deploy button is the same link.
export const REPO = "https://github.com/buildswithcoffee/vercel-ai-news-reader";
export const DEPLOY = `https://vercel.com/new/clone?${new URLSearchParams({
  "repository-url": REPO,
  "project-name": "signal",
  "repository-name": "signal",
  env: "PROFILE_EDIT_KEY",
  envDescription: "Your owner key: any password of 32+ characters. You'll use it to sign in to your Signal.",
  stores: JSON.stringify([{ type: "integration", integrationSlug: "neon", productSlug: "neon", protocol: "storage" }]),
})}`;

export type PartName = keyof typeof parts;
