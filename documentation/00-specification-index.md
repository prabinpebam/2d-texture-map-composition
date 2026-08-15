# 2D Texture Map Composition Specification

## Status

The detailing phase is complete and ready to enter implementation milestones M0
and M1. The production application has not been implemented. Exact HSL picker
visual parity and several architecture capabilities remain intentionally gated by
source evidence and executable spikes; those gates are defined below rather than
treated as completed work.

The human-authored `seed-spec.md` is immutable and remains the source of product
intent. Derived documents resolve ambiguities without changing that reference.

## Reading Order

| Order | Document | Purpose | Outcome state |
| --- | --- | --- | --- |
| 0 | `seed-spec.md` | Immutable human source | Preserved |
| 1 | `01-detailing-plan.md` | Plan for producing/evaluating specifications and implementation plan | Closed |
| 2 | `02-research-dossier.md` | Decision-relevant primary-source findings and required spikes | Drafting research closed; spikes pending |
| 3 | `03-product-requirements.md` | Scope, users, workflows, normative requirements, acceptance | Closed for M0/M1 |
| 4 | `04-image-processing-spec.md` | Canonical types, formulas, node contracts, catalogs, tolerances | Closed for M0/M1 |
| 5 | `05-architecture-runtime-persistence.md` | Modules, graph runtime, workers, cache, storage, schemas, security, budgets | Closed for M0/M1 |
| 6 | `06-ux-design-system.md` | Workspace, interactions, accessibility, picker, design system | Behavioral contract closed; picker visuals gated |
| 7 | `07-quality-evaluation.md` | Fixtures, oracles, E2E, performance, security, release gates | Closed |
| 8 | `08-implementation-plan.md` | Dependency-ordered vertical milestones and objective exit evidence | Ready to execute |
| 9 | `09-traceability-decisions-risks.md` | Seed coverage, decisions, risks, open questions, audit | Current |

The repository-root `agent-graph-loop.md` governs execution: outcomes and
definitions of done control nested loops; failed evaluations reopen the smallest
responsible workstream.

## Entry Gate for Implementation

M0 may begin when local toolchain prerequisites are selected and recorded. M1
must close all required spikes and ADRs before feature milestones depend on their
results. In particular:

- TIFF capabilities remain hidden until SPIKE-001 passes.
- Rust/WASM and optional WebGPU remain unaccepted until conformance and workload
  evidence pass SPIKE-002/003.
- Wide-gamut import claims remain bounded by SPIKE-004.
- PNG workflow envelope limits remain provisional until SPIKE-006.
- Normal-map auto behavior remains suggestion-only and may be removed if
  SPIKE-007 cannot establish useful confidence.
- Exact HSL picker visual parity remains blocked until the approved design source
  is supplied or behavior-only visuals are explicitly accepted before M8.2.

These constraints do not block the M0 foundation or the executable M1 spikes.

## Change Rules

- Never edit the seed reference.
- Normative behavior changes update requirement IDs, processing/runtime/UX
  contracts, implementation milestone, verification, and traceability together.
- Observable pixel changes require an algorithm version decision and migration
  behavior; opening an old workflow must not silently change its result.
- New blend or resize names require formula, stable ID/version, discriminating
  fixture, backend conformance, UI state, serialization, and traceability.
- Close a milestone only with its listed evidence. Task completion alone is not
  an outcome pass.