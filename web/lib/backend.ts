import "server-only";

// API_INTERNAL_URL is the base URL of the private Python service, injected by the
// service binding in vercel.json. Paths are relative to it, so there's no leading slash.
export async function requestRescore() {
  const res = await fetch(new URL("rescore", process.env.API_INTERNAL_URL), {
    method: "POST",
    redirect: "error", // a private service call never redirects; if one does, the URL is wrong
  });
  if (!res.ok) throw new Error(`Rescore failed with ${res.status}`);
}
