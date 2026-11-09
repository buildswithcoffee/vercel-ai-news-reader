# Security

## How sign-in works

Each Signal has one owner, who signs in with `PROFILE_EDIT_KEY`: a randomly generated password of at
least 32 characters, set as a server-only, sensitive environment variable. Never use a `NEXT_PUBLIC_`
variable or commit the value. A missing or short key disables sign-in.

- **Sign-in** sets an HttpOnly, Secure, SameSite=Lax cookie holding an HMAC of a fixed label, keyed by
  the key, for 30 days. It proves you know the key without containing it, and changing the key signs
  every browser out.
- **Private by default.** Unless the `public-access` flag is on, every page (`web/proxy.ts`) and Ask
  Signal (`agent/channels/eve.ts`) need that cookie. The flag defaults to off, so a new deployment, or
  one that can't reach Vercel Flags, stays private.
- **Owner-only either way.** Your feed and Follow-ups, and the Server Actions that change them, check
  the cookie again at the data layer (`web/lib/db.ts`), since Server Actions are public endpoints.
- **After sign-in** you return to the page you came from, but only to a path on this site
  (`web/lib/return-path.ts`, with tests).
- **Ask Signal** caps what each conversation can spend (`agent/agent.ts`), since a shared Signal lets
  anyone chat on the owner's AI Gateway credits.

To set the key on an existing project, enter it yourself at the prompt:

```sh
vercel env add PROFILE_EDIT_KEY --environment production --sensitive
```

## Profile-derived feed topics

`scores.topics` contains exact matches from the owner's saved interests, not public
article classifications. The feed data functions check owner credentials on every
request: anonymous visitors receive no topic labels or topic filter choices, and
supplied topic filters are ignored so they cannot probe saved selections. The
anonymous guide's `list_feed` tool never selects this column. All / No match filters,
scores, and explanations remain public. The authenticated owner can still see and
filter by matched topics. No migration or rescore is needed to protect existing rows.
Deployments still running the old code remain exposed until replaced or removed.

## Rescore admission and spending bounds

- Profile writes require owner authorization, including direct Server Action calls.
- Trimmed, validated profiles with sorted/deduplicated topics are compared atomically
  in PostgreSQL. Unchanged saves preserve scores and send no queue message. Changed
  profiles are admitted at most once every 15 minutes across web instances; earlier
  changes are rejected without changing the stored profile or scores.
- Queue messages are only wake-up hints, not authority to spend. The worker atomically
  claims the current database profile version at most once, with a durable 15-minute
  cooldown shared by daemon instances. Duplicates, old messages, and preview hints
  cannot rescore an already-claimed production profile. Periodic scans also check
  pending versions, recovering missed sends or changes deferred by the worker quota.
- Each admitted rescore considers only the 100 newest articles from the last three
  days. Local relevance filtering happens before paid calls. A process-wide semaphore
  allows at most four simultaneous AI calls across scans and rescores. Each call has
  a 30-second timeout, a 1,536-token output limit, and no SDK retries.
- Claims are persisted **before** paid work. A failed/interrupted rescore can leave
  partial results; replay does not retry that version and incur additional charges.
  A later admitted profile change can request another bounded batch. Older articles
  outside the batch remain unscored after a profile change. This is a deliberate
  cost-safety trade-off, not an exactly-once completion guarantee.

The API remains private behind its service binding. Queue sends use the shared
partition read by the daemon; merge this fix instead of the queue-only fix in #2.
Scheduled news ingestion is independent of profile changes and is not counted as
part of the rescore quota.

## Untrusted article destinations

Article reads accept only HTTP(S) URLs without credentials. Every hop is resolved
and all returned addresses must be public unicast; private, loopback, link-local,
reserved, mapped, and IPv6 translation/tunneling destinations are rejected. The
HTTP connection is made to a validated numeric IP, not to the hostname, so a
second DNS answer cannot redirect the connection into the daemon's private network.
The original Host header and HTTPS SNI/certificate name are preserved, with normal
certificate verification enabled. Environment proxies, shared connections, and
cookie forwarding are disabled for these reads. Redirects are handled explicitly,
validated again, and limited to ten hops.

A rejected or failed read returns no extracted text or metadata to the scan, so it
cannot become an article excerpt. The original source-feed summary remains the
fallback. This change does not audit or remove text already in the database; any
suspected historical exposure requires a separate data review. Platform-level
egress filtering remains useful defense in depth; this patch enforces the article
reader's destination restrictions in code and does not change infrastructure.

Run the focused, offline regression with the scorer's dependencies installed:

```sh
python scorer/check_article_fetch.py
```

It exercises the real HTTP transport against fake TCP peers, including DNS
rebinding, redirects, TLS hostname/verification settings, and public extraction.
