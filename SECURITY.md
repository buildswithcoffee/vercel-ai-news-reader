# Single-reader profile editing

The feed remains public, but `/interests` and the profile-saving data access function
require HTTP Basic credentials. Use username `owner` and a randomly generated,
high-entropy password of at least 32 characters. Set that password as the server-only
`PROFILE_EDIT_KEY` environment variable for the web service. Never use a
`NEXT_PUBLIC_` variable or commit the value. Missing or short keys disable editing.
Use HTTPS (except for local development); browsers may cache Basic credentials
until the browser session is closed. Rotating the key invalidates old credentials.

For Vercel, enter the value yourself at the CLI prompt, before deploying this change:

```sh
vercel env add PROFILE_EDIT_KEY --environment production --sensitive --project vercel-ai-news-reader
```

Use a separate key for preview/development environments if editing is needed there.
Deploy after configuring the variable. The normal web build applies the additive,
idempotent database migration before the daemon uses the new columns/table.

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
  a 30-second timeout, a 256-token output limit, and no SDK retries.
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
