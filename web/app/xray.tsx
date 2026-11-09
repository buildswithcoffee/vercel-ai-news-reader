import { parts, type Part, type PartName } from "@/lib/xray";

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
