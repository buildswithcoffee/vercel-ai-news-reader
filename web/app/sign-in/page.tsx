import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OWNER_COOKIE, isOwnerKey, ownerSession } from "@/lib/profile-owner";

export const metadata = { title: "Sign in · Signal" };

// Back to the page you came from: a path on this site, never another site's address.
function destination(next: unknown) {
  return typeof next === "string" && /^\/(?![/\\])/.test(next) ? next : "/";
}

async function signIn(formData: FormData) {
  "use server";
  const session = ownerSession();
  const next = destination(formData.get("next"));
  if (!session || !isOwnerKey(String(formData.get("key") ?? ""))) redirect(`/sign-in?wrong=1&next=${encodeURIComponent(next)}`);
  (await cookies()).set(OWNER_COOKIE, session, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(next);
}

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { wrong, next } = await searchParams;
  return (
    <section className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in to Signal</h1>
      <p className="mt-2 text-muted">Signal has one owner. Enter the PROFILE_EDIT_KEY set on this deployment.</p>
      <form action={signIn} className="mt-8 space-y-3">
        {/* Lets password managers file the key under a name. */}
        <input type="text" name="username" value="owner" autoComplete="username" readOnly hidden />
        <input type="hidden" name="next" value={destination(next)} />
        <input
          type="password"
          name="key"
          required
          autoFocus
          autoComplete="current-password"
          placeholder="Key"
          className="w-full rounded-lg border border-line bg-transparent px-3 py-2 outline-none focus:border-accent"
        />
        {wrong && <p className="text-sm text-red-500">That key didn&apos;t match.</p>}
        <button className="w-full rounded-md bg-accent px-5 py-2.5 font-medium text-white hover:opacity-90">Sign in</button>
      </form>
    </section>
  );
}
