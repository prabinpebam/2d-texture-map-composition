# M1 Persistence and Concurrency Probe

## Status

Pass for the selected IndexedDB transaction and lease architecture.

## Command and raw result

`npx playwright test -g "user receives verified local storage readiness"`

The actual Edge app reports `Storage verified` only after the following retained
probe values are true: atomic asset plus snapshot commit, injected quota rollback
with prior revision preserved, exactly one winner in a two-connection unique-key
lease race, rejected conflicting claimant, and BroadcastChannel intent delivery.
The observed lease winner was `tab-a`; either claimant is valid.

## Decision and fallback

Use one IndexedDB transaction for required snapshot records and assets. Treat
quota failure as complete rollback and retain the previous valid snapshot. Use a
unique project lease record for atomic arbitration and BroadcastChannel only for
coordination notices. A rejected claimant opens read-only or as a copy. See
`ADR-009-multi-tab-lease.md`.