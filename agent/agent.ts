import { defineAgent } from "eve";

export default defineAgent({
  model: "anthropic/claude-sonnet-5.5", // through AI Gateway, authenticated with the deployment's OIDC token
  // The guide only reads, so it gets its own tools (in tools/) instead of eve's defaults: Vercel's docs,
  // and the stories in your feed.
  defaultTools: false,
  limits: {
    // When Signal is public, anyone can chat with the guide, so cap what a single conversation can spend.
    sessionUsage: ({ total }) => (total.costUsd ?? 0) >= 0.5,
  },
});
