import { withEve } from "eve/vercel";

// One project, four parts: the Next.js app, a private Python API, the scorer daemon, and the
// guide agent in agent/. withEve adds the agent as its own service and routes /eve/v1/* to it.
export default await withEve({
  services: {
    web: {
      root: "web/",
      bindings: [{ type: "service", service: "api", format: "url", env: "API_INTERNAL_URL" }],
    },
    api: {
      root: "api/",
      entrypoint: "main:app",
    },
  },
  routes: [{ src: "^(.*)$", destination: { type: "service", service: "web" } }],
  daemons: {
    scorer: {
      root: "scorer/",
      entrypoint: "Dockerfile",
      instances: { iad1: 1 },
    },
  },
});
