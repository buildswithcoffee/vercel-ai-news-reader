import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/feed");

  return (
    <section className="py-16">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        The tech and AI news that matters to you, and why.
      </h1>
      <p className="mt-5 max-w-xl text-lg text-muted">
        Signal reads hundreds of stories a day, scores each one against what you care about, and
        tells you in one line why it matters to you.
      </p>
      <SignInButton mode="modal" forceRedirectUrl="/interests">
        <button className="mt-8 rounded-md bg-accent px-5 py-2.5 font-medium text-white hover:opacity-90">
          Get your briefing
        </button>
      </SignInButton>
    </section>
  );
}
