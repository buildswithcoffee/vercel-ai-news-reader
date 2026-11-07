import { Chat } from "./chat";

export const metadata = { title: "Ask · Signal" };

export default function AskPage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Ask the guide</h1>
      <p className="mt-2 text-muted">How Signal works, what Vercel can do, and why it matters for your business.</p>
      <Chat />
    </section>
  );
}
