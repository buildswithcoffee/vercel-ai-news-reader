"use client";

import { createContext, use, useState, type ReactNode } from "react";
import { Chat, type StoryRef } from "./chat";

const GuideContext = createContext<(story: StoryRef) => void>(() => {});

// The guide waits in the lower-right corner of every page. It lives in the root layout and stays
// mounted while closed, so the conversation carries on as you move around. `chat` is off on a private
// Signal until you sign in.
export function Guide({ chat, children }: { chat: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [story, setStory] = useState<StoryRef | null>(null);
  if (!chat) return children;

  function askAbout(next: StoryRef) {
    setStory(next);
    setOpen(true);
  }

  return (
    <GuideContext value={askAbout}>
      {children}
      <div
        role="dialog"
        aria-label="Ask Signal"
        hidden={!open}
        className="fixed right-4 bottom-4 z-50 flex h-[min(36rem,calc(100dvh-2rem))] w-[min(26rem,calc(100vw-2rem))] flex-col rounded-xl border border-line bg-background shadow-2xl [&[hidden]]:hidden"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="font-medium">Ask Signal</p>
          <button onClick={() => setOpen(false)} aria-label="Close" className="text-xl leading-none text-muted hover:text-foreground">
            ×
          </button>
        </div>
        <Chat story={story} onClearStory={() => setStory(null)} focus={open} />
      </div>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-4 z-50 rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-background shadow-lg hover:opacity-90"
        >
          Ask Signal
        </button>
      )}
    </GuideContext>
  );
}

// Opens the guide with this story attached, so you can pick up where its "why" left off.
export function AskAbout({ story, className }: { story: StoryRef; className: string }) {
  const askAbout = use(GuideContext);
  return (
    <button onClick={() => askAbout(story)} className={className}>
      Ask Signal about this
    </button>
  );
}
