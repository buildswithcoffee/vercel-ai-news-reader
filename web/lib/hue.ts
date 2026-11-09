// A color for each topic and source, picked from its name so it's the same on every page and every
// visit. Mid-tone hues that read on both themes; the .tint class in globals.css does the rest.
const HUES = ["#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#14b8a6", "#6366f1", "#f97316"];

export function hue(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return HUES[Math.abs(hash) % HUES.length];
}
