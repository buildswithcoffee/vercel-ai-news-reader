import { parts, type Part, type PartName } from "@/lib/xray";

// A card per part: what it does in Signal, why it's good, and where to learn more.
export function PartCards({ show }: { show: PartName[] }) {
  return (
    <div className="my-6 grid gap-3 sm:grid-cols-2">
      {show.map((name) => (
        <div key={name} className="rounded-xl border border-dashed border-accent p-4 text-sm">
          <Logo part={name} />
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

// A product's logo, drawn in the text color so it fits light and dark themes.
export function Logo({ part }: { part: PartName }) {
  const { logo, name }: Part = parts[part];
  if (!logo) return null;
  return (
    <span
      role="img"
      aria-label={name}
      className="mb-2 block h-4 bg-foreground"
      style={{ aspectRatio: `${logo.width} / ${logo.height}`, mask: `url(${logo.src}) center / contain no-repeat` }}
    />
  );
}
