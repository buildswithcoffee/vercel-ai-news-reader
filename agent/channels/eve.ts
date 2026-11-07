import { none } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

// The chat the web app's Ask page talks to, at /eve/v1. It's public, like the rest of Signal;
// agent.ts caps what each conversation can spend.
export default eveChannel({ auth: [none()] });
