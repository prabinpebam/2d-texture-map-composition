# ADR-004: Tile and Cache Policy

- Status: Accepted
- Evidence: `documentation/evidence/m1/SPIKE-005-large-workflow.md`

Evaluate demanded 512-square logical tiles with explicit byte reservations and
at most six CPU workers. Cache identity includes algorithm, parameters, ordered
input hashes, tile, halo, extent, and quality tier. Never allocate logical source
size. Stale generations release reservations and cannot publish. On pressure,
reduce concurrency and tile size before returning a bounded failure.