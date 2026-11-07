"use client";

import { useEffect, useRef } from "react";
import { useEveAgent } from "eve/react";

export type StoryRef = { id: string; title: string };

const STARTERS = [
  "What matters most in my feed today?",
  "How is Signal built on Vercel?",
  "What would AI Gateway save my team?",
];
const STORY_STARTERS = ["Tell me more about this story", "What should I do about this?"];

const TOOL_LABELS: Record<string, string> = {
  read_story: "Reading the story…",
  list_feed: "Looking at your feed…",
};

// Talks to the guide agent at /eve/v1 on this same domain. eve keeps the conversation durable
// on the server; this component just sends messages and renders the stream. An attached story
// rides along with each message as context, and the agent reads it from the database.
export function Chat({ story, onClearStory, focus }: { story: StoryRef | null; onClearStory: () => void; focus: boolean }) {
  const agent = useEveAgent();
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focus) input.current?.focus();
  }, [focus, story]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [agent.messages]);

  function ask(message: string) {
    if (!message.trim() || agent.status === "resuming") return;
    void agent.send(message.trim(), story ? { clientContext: { story } } : undefined);
  }

  return (
    <>
      <div ref={log} className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
        {agent.messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {(story ? STORY_STARTERS : STARTERS).map((starter) => (
              <button
                key={starter}
                onClick={() => ask(starter)}
                className="rounded-full border border-line px-3 py-1.5 text-left hover:border-accent"
              >
                {starter}
              </button>
            ))}
          </div>
        )}

        {agent.messages.map((message) => (
          <div
            key={message.id}
            className={message.role === "user" ? "ml-auto w-fit max-w-[85%] rounded-xl bg-surface px-3 py-2" : ""}
          >
            {message.parts.map((part, index) => {
              if (part.type === "text") {
                return (
                  <p key={part.id ?? index} className="whitespace-pre-wrap">
                    <Linkified text={part.text} />
                  </p>
                );
              }
              if (part.type === "tool") {
                return (
                  <p key={part.callId} className="text-xs text-muted">
                    {TOOL_LABELS[part.name] ?? `Reading ${String((part.input as { url?: string } | undefined)?.url ?? "the docs")}…`}
                  </p>
                );
              }
              if (part.type === "interaction") {
                return (
                  <p key={index} className="text-muted">
                    This conversation reached its limit. Reload the page to start a new one.
                  </p>
                );
              }
              return null;
            })}
          </div>
        ))}
        {agent.error && <p className="text-red-500">Something went wrong: {agent.error.message}</p>}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          ask(String(new FormData(form).get("message") ?? ""));
          form.reset();
        }}
        className="border-t border-line p-3"
      >
        {story && (
          <p className="mb-2 flex items-center gap-2 text-xs text-muted">
            <span className="truncate">
              About: <span className="text-foreground">{story.title}</span>
            </span>
            <button type="button" onClick={onClearStory} aria-label="Detach this story" className="hover:text-foreground">
              ×
            </button>
          </p>
        )}
        <div className="flex gap-2">
          <input
            ref={input}
            name="message"
            autoComplete="off"
            placeholder={story ? "Ask about this story" : "Ask about your feed, Signal, or Vercel"}
            disabled={agent.status === "resuming"}
            className="min-w-0 flex-1 rounded-lg border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            {agent.status === "busy" ? "…" : "Ask"}
          </button>
        </div>
      </form>
    </>
  );
}

// The guide writes plain text with bare URLs; make those clickable.
function Linkified({ text }: { text: string }) {
  return text.split(/(https:\/\/\S+[^\s.,;:!?)])/).map((chunk, index) =>
    index % 2 ? (
      <a key={index} href={chunk} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
        {chunk}
      </a>
    ) : (
      chunk
    ),
  );
}
