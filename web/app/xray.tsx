import { cookies } from "next/headers";
import { parts, type PartName } from "@/lib/xray";

// X-ray mode shows what Vercel is doing behind each part of the page. Like the theme, it's a
// cookie read on the server.
export async function isXrayOn() {
  return (await cookies()).get("xray")?.value === "on";
}

async function toggleXray() {
  "use server";
  const jar = await cookies();
  if (await isXrayOn()) jar.delete("xray");
  else jar.set("xray", "on", { maxAge: 60 * 60 * 24 * 365 });
}

export async function XraySwitch() {
  const on = await isXrayOn();
  return (
    <form action={toggleXray}>
      <button
        aria-pressed={on}
        className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:text-foreground aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-white"
      >
        X-ray {on ? "on" : "off"}
      </button>
    </form>
  );
}

// Shows these parts when X-ray mode is on. Pass `always` to show them regardless.
export async function Xray({ show, always = false }: { show: PartName[]; always?: boolean }) {
  if (!always && !(await isXrayOn())) return null;
  return (
    <div className="my-6 grid gap-3 sm:grid-cols-2">
      {show.map((name) => (
        <PartCard key={name} name={name} />
      ))}
    </div>
  );
}

function PartCard({ name }: { name: PartName }) {
  const part = parts[name];
  return (
    <div className="rounded-xl border border-dashed border-accent p-4 text-sm">
      <p className="font-mono text-[10px] uppercase tracking-widest text-accent">X-ray</p>
      <p className="mt-1 font-medium">{part.name}</p>
      <p className="mt-2">{part.what}</p>
      <p className="mt-2 text-muted">{part.why}</p>
      <a href={part.href} target="_blank" rel="noreferrer" className="mt-2 inline-block text-accent hover:underline">
        Learn more →
      </a>
    </div>
  );
}
