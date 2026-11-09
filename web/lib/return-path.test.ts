import assert from "node:assert/strict";
import { test } from "node:test";
import { returnPath } from "./return-path.ts";

test("keeps paths on this site", () => {
  assert.equal(returnPath("/xray"), "/xray");
  assert.equal(returnPath("/your-feed?sort=new"), "/your-feed?sort=new");
});

test("refuses anything that leads to another site", () => {
  for (const next of [
    "/\t/evil.com", // control characters the browser drops
    "/\n/evil.com",
    "/\r/evil.com",
    "/\u0000/evil.com",
    "//evil.com", // protocol-relative
    "/\\evil.com", // backslashes the browser reads as slashes
    "\\\\evil.com",
    "/.//evil.com", // dot segments that resolve to //
    "/x/..//evil.com",
    "/%2e//evil.com",
    "https://evil.com", // full addresses
    "javascript:alert(1)",
    "http://[", // unparseable
    undefined,
  ]) {
    assert.equal(returnPath(next), "/", JSON.stringify(next));
  }
});
