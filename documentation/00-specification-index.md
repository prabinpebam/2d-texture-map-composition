# 2D Texture Map Composition Specification

## Status

The detailing phase and implementation milestones M0-M1 are complete. The
repository now contains a validated workspace foundation, scalar processing
oracle, Rust/WASM worker prototype, bounded tile and PNG-envelope adapters,
storage recovery proof, architecture decisions, and mandatory Playwright UX
evaluation against the actual app in Microsoft Edge. Product feature milestones
M2-M10 remain to be implemented. Failed M1 capability spikes remain intentionally
hidden or bounded rather than treated as completed product work.

The human-authored `seed-spec.md` is immutable and remains the source of product
intent. Derived documents resolve ambiguities without changing that reference.

## Reading Order

| Order | Document | Purpose | Outcome state |
| --- | --- | --- | --- |
| 0 | `seed-spec.md` | Immutable human source | Preserved |
| 1 | `01-detailing-plan.md` | Plan for producing/evaluating specifications and implementation plan | Closed |
| 2 | `02-research-dossier.md` | Decision-relevant primary-source findings and required spikes | Research and M1 spike execution closed |
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

M0 and M1 closed with formatting, lint, unit/accessibility, build, dependency,
numeric, and actual-app Playwright UX evidence. Dependent feature milestones must
honor these M1 results:

- TIFF capabilities remain hidden until SPIKE-001 passes.
- Rust/WASM is accepted behind its worker protocol; WebGPU product dispatch
  remains disabled pending the full conformance matrix.
- Wide-gamut import claims remain bounded by SPIKE-004.
- PNG workflow envelope limits and metadata-failure behavior are accepted.
- Normal-map automatic suggestion remains disabled because SPIKE-007 did not
  establish representative-corpus confidence.
- Exact HSL picker visual parity remains blocked until the approved design source
  is supplied or behavior-only visuals are explicitly accepted before M8.2.

These constraints do not block M2 graph authoring or M3 local persistence.

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