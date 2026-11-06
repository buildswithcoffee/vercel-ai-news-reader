import "server-only";

// API_INTERNAL_URL points at the private Python service. Vercel injects it
// through the service binding in vercel.json.
export async function requestRescore(userId: string) {
  const res = await fetch(new URL("/rescore", process.env.API_INTERNAL_URL), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) throw new Error(`Rescore failed with ${res.status}`);
}
