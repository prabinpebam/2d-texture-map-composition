# ADR-009: Multi-Tab Lease

- Status: Accepted
- Evidence: `documentation/evidence/m1/M1-persistence-concurrency.md`

IndexedDB owns lease authority through one unique project record and conditional
snapshot commits. BroadcastChannel carries intent and renewal notices but never
decides ownership. A losing or stale claimant cannot overwrite and opens
read-only, takes over only after expiry, or creates a copy preserving both
revisions.