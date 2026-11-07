import { defineAgent } from "eve";

export default defineAgent({
  model: "anthropic/claude-sonnet-5.5", // through AI Gateway, authenticated with the deployment's OIDC token
  // The guide only reads public docs, so it gets one tool (tools/web_fetch.ts) instead of eve's defaults.
  defaultTools: false,
  limits: {
    // Anyone can chat with the guide, so cap what a single conversation can spend.
    sessionUsage: ({ total }) => (total.costUsd ?? 0) >= 0.5,
  },
});
