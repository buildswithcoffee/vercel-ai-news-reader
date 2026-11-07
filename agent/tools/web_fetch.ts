import { defineTool } from "eve/tools";
import { webFetch } from "eve/tools/web_fetch";

// The guide answers from public docs, so it can only read these sites.
const SITES = ["vercel.com", "nextjs.org", "eve.dev"];

export default defineTool({
  ...webFetch,
  description: `Read a page from ${SITES.join(", ")}.`,
  async execute(input, ctx) {
    const host = new URL(input.url).hostname;
    if (!SITES.some((site) => host === site || host.endsWith(`.${site}`))) {
      throw new Error(`Only pages on ${SITES.join(", ")} can be read.`);
    }
    return webFetch.execute(input, ctx);
  },
});
