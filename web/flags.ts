import { flag } from "flags/next";
import { vercelAdapter } from "@flags-sdk/vercel";

// Managed in Vercel Flags: the dashboard or `vercel flags`. Off in production until you turn it on;
// on in preview and development.
export const followUpsFlag = flag<boolean>({
  key: "follow-ups",
  description: "Follow-ups: save a to-do from any story, like telling a coworker, and track it on its own tab.",
  defaultValue: false, // if Vercel Flags can't be reached, the feature stays hidden
  adapter: vercelAdapter,
});
