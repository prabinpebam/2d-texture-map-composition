# M1 Closure

## Outcome

M1 closes with executable architecture evidence and explicit capability gates.
Passing prototypes freeze the scalar/WASM, worker, tile reservation, PNG
metadata, and IndexedDB lease boundaries. Failed optional spikes keep their UI
and product claims hidden.

## Spike matrix

| Evidence | Outcome | Product consequence |
| --- | --- | --- |
| SPIKE-001 TIFF | Fail | TIFF hidden; codec adapter retained. |
| SPIKE-002 CPU kernel | Pass | Rust/WASM worker accepted with scalar fallback. |
| SPIKE-003 WebGPU | Prototype parity pass; enablement fail | Product dispatch remains CPU/WASM. |
| SPIKE-004 color import | sRGB pass; wide-gamut canonical path fail | Launch import bounded to sRGB behavior. |
| SPIKE-005 large workflow | Architecture pass | Demand-driven reservations and stale-generation suppression accepted. |
| SPIKE-006 PNG envelope | Pass | Bounded optional iTXt adapter accepted. |
| SPIKE-007 normal heuristic | Confidence fail | Automatic suggestion disabled; manual controls remain. |
| SPIKE-008 HSL source | Blocked | Exact visual parity remains unclaimed. |
| Persistence concurrency | Pass | Atomic snapshots, quota rollback, unique lease, and broadcast notices accepted. |

## Final validation

- Rust: 3 tests passed; Clippy passed with warnings denied.
- App: formatting and ESLint passed; 35 Vitest checks passed.
- Backend: 5 independent WASM vectors passed; production worker bundle built.
- Actual app: 5 Microsoft Edge journeys passed with no browser/worker errors.
- UX: the user opens runtime diagnostics with pointer input, sees conformant
  compute and storage recovery status, remains focus-contained, closes with
  Escape, and returns focus to the trigger. Axe reports zero open-dialog
  violations; paint, geometry, hit testing, screenshots, browser pixel samples,
  GPU loss, and persistence values are retained in Playwright artifacts.

The next allowed work is M2 graph authoring and M3 local project persistence
against these frozen boundaries.