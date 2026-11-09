import { createClient } from "@vercel/flags-core";
import { type AuthFn, localDev, none } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";
import { isOwnerRequest } from "../owner";

// The chat the web app's Ask Signal panel talks to, at /eve/v1. Same rule as the pages (web/proxy.ts):
// the signed-in owner can always chat, and everyone else only while the public-access flag is on.
const flags = createClient();
const anyone = none<Request>();

const owner: AuthFn<Request> = (request) =>
  isOwnerRequest(request) ? { attributes: {}, authenticator: "signal", principalId: "owner", principalType: "user" } : null;

const visitors: AuthFn<Request> = async (request) => {
  const open = await flags.evaluate("public-access", false).then((result) => result.value, () => false);
  return open ? anyone(request) : null;
};

export default eveChannel({ auth: [owner, visitors, localDev()] });
