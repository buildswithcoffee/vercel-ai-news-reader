import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { countOpenFollowUps, isOwner } from "@/lib/db";
import { followUpsFlag, publicAccessFlag } from "@/flags";
import { Guide } from "./guide";
import { ThemeSwitch, getTheme } from "./theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Signal",
  description: "The tech and AI news that matters to you, and why.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Ask Signal follows the same rule as the pages: the owner, or anyone when Signal is public.
  const chat = (await isOwner()) || (await publicAccessFlag());
  return (
    <html
      lang="en"
      data-theme={await getTheme()}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Guide chat={chat}>
        <header className="border-b border-line">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              Signal
            </Link>
            <nav className="flex gap-4 text-sm text-muted">
              <Link href="/" className="hover:text-foreground">Feed</Link>
              <Link href="/your-feed" className="hover:text-foreground">Your feed</Link>
              <FollowUpsLink />
              <Link href="/how-it-works" className="hover:text-foreground">How it works</Link>
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <Link
                href="/xray"
                className="rounded-full border border-accent px-3 py-1 text-xs text-accent hover:bg-accent hover:text-white"
              >
                X-ray
              </Link>
              <ThemeSwitch />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-10 pb-24">{children}</main>
        </Guide>
      </body>
    </html>
  );
}

// Shown when the follow-ups flag is on and you're signed in, with how many are still open.
async function FollowUpsLink() {
  if (!(await isOwner()) || !(await followUpsFlag())) return null;
  const open = await countOpenFollowUps();
  return (
    <Link href="/follow-ups" className="hover:text-foreground">
      Follow-ups{open > 0 && <span className="ml-1 rounded-full bg-accent px-1.5 text-xs text-white">{open}</span>}
    </Link>
  );
}
