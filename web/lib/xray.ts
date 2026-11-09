// The Vercel product behind each part of Signal, for X-ray's notes and the steps on Setup.
// Each part: why it's good, and where to learn more.

export type Part = {
  name: string;
  why: string;
  href: string;
  logo?: { src: string; width: number; height: number }; // from public/logos, black on transparent
};

export const parts = {
  cdn: {
    name: "CDN and Firewall",
    why: "Fast everywhere and protected by default, with nothing to set up.",
    href: "https://vercel.com/docs/vercel-firewall",
  },
  web: {
    name: "Next.js on Fluid Compute",
    why: "You write React; Vercel runs the server parts on Fluid Compute, which scales with traffic, reuses warm instances, and bills for active CPU, not idle time.",
    href: "https://vercel.com/docs/fluid-compute",
    logo: { src: "/logos/nextjs.png", width: 300, height: 64 },
  },
  neon: {
    name: "Neon Postgres, from the Marketplace",
    why: "One click instead of a separate signup, one bill, and every preview deployment gets its own copy of the database.",
    href: "https://vercel.com/marketplace/neon",
  },
  api: {
    name: "A private Python service",
    why: "Use the right language for each job, in one project and one deploy, with no keys to manage between your own services.",
    href: "https://vercel.com/docs/services/bindings",
  },
  queue: {
    name: "Vercel Queues",
    why: "Your save returns instantly, and queued work is delivered even if a worker restarts.",
    href: "https://vercel.com/docs/queues",
  },
  daemon: {
    name: "A Vercel Daemon",
    why: "Long-running workers deploy from the same git push as your app, with no separate infrastructure.",
    href: "https://vercel.com/docs/daemons",
  },
  gateway: {
    name: "AI Gateway",
    why: "One endpoint for hundreds of models, with spend tracking, fallbacks, and no provider keys to rotate.",
    href: "https://vercel.com/docs/ai-gateway",
    logo: { src: "/logos/ai-gateway.png", width: 338, height: 64 },
  },
  agent: {
    name: "An eve agent",
    why: "Conversations are durable and survive restarts, every run is traced in Agent Runs, and it ships with the same git push.",
    href: "https://eve.dev/docs",
    logo: { src: "/logos/eve.png", width: 204, height: 64 },
  },
  services: {
    name: "Vercel Services",
    why: "Each part uses the right language for its job, and they all ship together from one git push.",
    href: "https://vercel.com/docs/services",
  },
  workflow: {
    name: "Vercel Workflow",
    why: "A conversation survives restarts and redeploys and picks up where it left off, with no queue or state store to build.",
    href: "https://vercel.com/docs/workflow",
  },
  sandbox: {
    name: "Vercel Sandbox",
    why: "Code the model writes runs in an isolated VM, away from your app and your data.",
    href: "https://vercel.com/docs/vercel-sandbox",
  },
  observability: {
    name: "Observability",
    why: "When something breaks you see it across the whole app, without wiring up a logging vendor.",
    href: "https://vercel.com/docs/observability",
  },
  previews: {
    name: "Git and preview deployments",
    why: "Review the real thing before it ships. Merge it and production updates.",
    href: "https://vercel.com/docs/deployments/preview-deployments",
  },
} satisfies Record<string, Part>;

export type PartName = keyof typeof parts;
