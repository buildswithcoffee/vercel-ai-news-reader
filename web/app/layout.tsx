import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
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
  return (
    <html
      lang="en"
      data-theme={await getTheme()}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Guide>
        <header className="border-b border-line">
          <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              Signal
            </Link>
            <nav className="flex gap-4 text-sm text-muted">
              <Link href="/" className="hover:text-foreground">Feed</Link>
              <Link href="/interests" className="hover:text-foreground">Interests</Link>
              <Link href="/sources" className="hover:text-foreground">Sources</Link>
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
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">{children}</main>
        </Guide>
      </body>
    </html>
  );
}
