import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
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

// Headlines are set in a serif, so the feed reads like a front page.
const newsreader = Newsreader({
  variable: "--font-newsreader",
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
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Guide chat={chat}>
        <header className="border-b border-line">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-serif text-xl font-medium tracking-tight">
              <Mark />
              Signal
            </Link>
            <nav className="flex gap-4 text-sm text-muted">
              <Link href="/" className="hover:text-foreground">Feed</Link>
              <Link href="/setup" className="hover:text-foreground">Setup</Link>
              <FollowUpsLink />
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

// Signal's mark: a source and the waves coming off it. The same drawing as docs/logo.svg.
function Mark() {
  return (
    <svg viewBox="0 0 56 56" aria-hidden className="h-6 w-6">
      <rect width="56" height="56" rx="14" className="fill-accent" />
      <circle cx="18" cy="38" r="4" fill="#fff" />
      <path d="M18 26a12 12 0 0 1 12 12" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M18 16a22 22 0 0 1 22 22" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".6" />
    </svg>
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
