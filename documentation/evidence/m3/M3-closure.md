# M3 Closure

## Outcome

Authored graph projects autosave transactionally and recover from interruption,
quota errors, schema migration, and tab conflicts. The app owns capability UI;
a dedicated versioned persistence worker owns IndexedDB, hashing, transactions,
project lifecycle, checkpoints, preview reclamation, and leases.

## Persistence and integrity

- Complete snapshot insert, project pointer/revision update, and checkpoint
  deletion commit atomically after SHA-256 is computed outside the transaction.
- Current snapshot checksums are verified on open. Corrupt records remain stored
  while the newest prior valid revision restores visibly.
- Pagehide/hidden writes an integrity-checked checkpoint. A newer valid checkpoint
  restores as `Recovered prior snapshot`.
- Content-addressed assets deduplicate identical bytes. Preview cache is
  reclaimable by exact byte count and is the only automatic quota victim.
- Quota failure retries once after preview reclamation; otherwise the UI reports
  unsaved work and leaves portable workflow export available.

## Autosave and durability

- Commands coalesce for 500 ms; explicit and automatic saves share one serialized
  queue. Rapid explicit saves publish the latest graph, never an older completion.
- Bounds, z-order, states, edges, and the actual React Flow viewport persist.
  Reload restores 120% zoom and visible node paint without undo history.
- Persistent-storage permission is requested once after meaningful work, stored
  on the project, and not requested again after reload. Diagnostics show
  persistent/best-effort status and live usage/quota.

## Projects, migrations, and conflicts

- Project browser supports create, open, rename, reversible trash, restore, and
  permanent deletion; active projects cannot be deleted.
- IndexedDB v1 upgrades to v2 with projects/snapshots preserved and new previews
  and settings stores available.
- One tab owns a six-second random-token lease renewed every two seconds. Foreign
  tabs are visibly read-only and cannot mutate or save. Take Over broadcasts
  intent and conditionally retries through expiry; stale tokens cannot commit.
- Open Copy rewrites project identity into a new writable snapshot while the
  original writer remains active, preserving both revision streams.

## Evaluation

Actual Microsoft Edge journeys cover repository corruption, checkpoints, quota,
migration, worker protocol rejection, queued saves, autosave/reload, durability,
project lifecycle, two-tab read-only/takeover, and Open Copy. Supporting tests
enforce the UI-to-worker boundary, protocol versions, graph persistence, numeric
oracles, formatting, lint, Rust/WASM parity, and production worker bundles.

M4 may now build image import and preview scheduling on the frozen graph,
workflow, compute-worker, and persistence-worker contracts.