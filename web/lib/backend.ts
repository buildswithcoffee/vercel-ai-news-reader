import "server-only";

// API_INTERNAL_URL points at the private Python service. Vercel injects it
// through the service binding in vercel.json.
export async function requestRescore() {
  const res = await fetch(new URL("/rescore", process.env.API_INTERNAL_URL), { method: "POST" });
  if (!res.ok) throw new Error(`Rescore failed with ${res.status}`);
}
