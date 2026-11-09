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

// Off: Signal is private. Every page, and Ask Signal, need the owner's sign-in. On: anyone with the
// link can read the feed and chat, on this deployment's AI Gateway tokens. Your feed and follow-ups
// stay the owner's either way.
export const publicAccessFlag = flag<boolean>({
  key: "public-access",
  description: "Public access: anyone with the link can read the feed and ask Signal. Off keeps Signal private to its owner.",
  defaultValue: false, // a new deployment, or one that can't reach Vercel Flags, stays private
  adapter: vercelAdapter,
});
