# SPIKE-005 Large Workflow

## Status

Pass for the bounded scheduling architecture; full workflow performance remains
a later milestone gate.

## Command and raw result

`npm run test -- src/workers/tileWorkloadProbe.test.ts`

- A standard logical preview processed 80 active tiles with six workers.
- Four MiB tiles peaked at 24 MiB reserved, below the 256 MiB fallback budget.
- A stale large-workflow generation processed zero tiles and could not publish.
- A tile larger than the complete budget failed before allocation.
- Three tests passed in 10 ms of test execution on the reference desktop run.

## Decision and fallback

Accept demand-driven tiles, explicit reservation before allocation, concurrency
capped at six, and generation checks before work and publication. Do not allocate
logical source size or full-frame intermediates. Reduce concurrency, then tile
size, before a bounded actionable failure. See `ADR-004-tile-cache-policy.md`.