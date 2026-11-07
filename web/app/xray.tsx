import { parts, type PartName } from "@/lib/xray";

// A card per part: what it does in Signal, why it's good, and where to learn more.
export function PartCards({ show }: { show: PartName[] }) {
  return (
    <div className="my-6 grid gap-3 sm:grid-cols-2">
      {show.map((name) => (
        <div key={name} className="rounded-xl border border-dashed border-accent p-4 text-sm">
          <p className="font-medium">{parts[name].name}</p>
          <p className="mt-2">{parts[name].what}</p>
          <p className="mt-2 text-muted">{parts[name].why}</p>
          <a href={parts[name].href} target="_blank" rel="noreferrer" className="mt-2 inline-block text-accent hover:underline">
            Learn more →
          </a>
        </div>
      ))}
    </div>
  );
}
