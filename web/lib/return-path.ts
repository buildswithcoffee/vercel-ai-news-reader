// Where sign-in sends you afterwards: the page you came from, but only on this site, so a crafted
// sign-in link can't bounce the owner to another site once they've logged in.
//  - Control characters and backslashes are refused outright: browsers silently drop tabs and
//    newlines and read \ as /, so "/<tab>/evil.com" would become "//evil.com".
//  - The rest is parsed the way the browser will, against a stand-in origin, and kept only if it
//    stays on that origin and doesn't start with "//" ("/.//evil.com" resolves to "//evil.com").
export function returnPath(next: unknown): string {
  if (typeof next !== "string" || /[\u0000-\u001f\u007f\\]/.test(next)) return "/";
  const here = "https://signal.invalid";
  const url = URL.parse(next, here);
  if (url?.origin !== here || url.pathname.startsWith("//")) return "/";
  return url.pathname + url.search;
}
