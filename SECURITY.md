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
