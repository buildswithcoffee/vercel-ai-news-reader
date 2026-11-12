"use client";

import { useRef, useState } from "react";

const LABELS = { idle: "Copy prompt", copied: "Copied", selected: "Selected: press ⌘C or Ctrl+C" };

// A prompt to paste into your coding agent, with a button that copies it. Where the browser blocks
// the clipboard, the button selects the prompt instead, ready to copy by hand.
export function Prompt({ text }: { text: string }) {
  const prompt = useRef<HTMLParagraphElement>(null);
  const [state, setState] = useState<keyof typeof LABELS>("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      getSelection()?.selectAllChildren(prompt.current!);
      setState("selected");
    }
    setTimeout(() => setState("idle"), 2500);
  }

  return (
    <div className="mt-3 rounded-lg bg-surface p-3">
      <p ref={prompt} className="font-mono text-xs leading-relaxed">
        {text}
      </p>
      <button onClick={copy} className="mt-2 text-xs font-medium text-muted hover:text-foreground">
        {LABELS[state]}
      </button>
    </div>
  );
}
