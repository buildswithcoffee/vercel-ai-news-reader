"use client";

import { useEveAgent } from "eve/react";

const STARTERS = [
  "How is Signal built on Vercel?",
  "Why run Python and Next.js in one project?",
  "What would AI Gateway save my team?",
];

// Talks to the guide agent at /eve/v1 on this same domain. eve keeps the conversation durable
// on the server; this component just sends messages and renders the stream.
export function Chat() {
  const agent = useEveAgent();

  function ask(message: string) {
    if (message.trim() && agent.status !== "resuming") void agent.send(message.trim());
  }

  return (
    <div className="mt-8">
      {agent.messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {STARTERS.map((starter) => (
            <button
              key={starter}
              onClick={() => ask(starter)}
              className="rounded-full border border-line px-3.5 py-1.5 text-sm hover:border-accent"
            >
              {starter}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-6">
        {agent.messages.map((message) => (
          <div
            key={message.id}
            className={message.role === "user" ? "ml-auto w-fit max-w-[85%] rounded-xl bg-surface px-4 py-2" : ""}
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
                    Reading {String((part.input as { url?: string } | undefined)?.url ?? "the docs")}…
                  </p>
                );
              }
              if (part.type === "interaction") {
                return (
                  <p key={index} className="text-sm text-muted">
                    This conversation reached its limit. Reload the page to start a new one.
                  </p>
                );
              }
              return null;
            })}
          </div>
        ))}
        {agent.error && <p className="text-sm text-red-500">Something went wrong: {agent.error.message}</p>}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          ask(String(new FormData(form).get("message") ?? ""));
          form.reset();
        }}
        className="mt-8 flex gap-2"
      >
        <input
          name="message"
          autoComplete="off"
          placeholder="Ask about Signal or Vercel"
          disabled={agent.status === "resuming"}
          className="min-w-0 flex-1 rounded-lg border border-line bg-transparent px-3 py-2 outline-none focus:border-accent"
        />
        <button className="rounded-md bg-accent px-4 py-2 font-medium text-white hover:opacity-90">
          {agent.status === "busy" ? "…" : "Ask"}
        </button>
      </form>
    </div>
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
