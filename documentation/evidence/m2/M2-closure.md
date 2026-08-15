# M2 Closure

> **2026-08-15 amendment:** Graph domain, typed edges, command, workflow, and
> accessibility evidence remains accepted. Node presentation/management UX is
> reopened through R1 because common controls and results must move into nodes and
> explicit run/queue behavior must be added. This document does not by itself
> satisfy `10-node-first-workbench-update.md`.

## Outcome

Users can create and edit a typed, accessible DAG independently of image
processing. Canonical authored state owns React Flow presentation; UI actions and
keyboard alternatives dispatch through one validated command store.

## Product evidence

- Add nodes from searchable library, inspector command, or `Shift+A` dialog.
- Select singly or additively, move by pointer or keyboard, resize by 24 px handle
  or exact geometry dialog, duplicate, delete, bypass, mute, lock, bring to front,
  undo, and redo.
- `Shift+C` creates compatible edges without dragging. Pointer and dialog paths
  share type, port, cardinality, duplicate, and cycle validation with visible
  rejection feedback.
- `Shift+F10` opens a focused command menu; F6 regions, Home/End graph focus,
  Escape selection clearing, graph outline, minimap, and toolbar alternatives are
  available.
- Graph workflow v1 downloads and imports through JSON Schema plus semantic
  validation. Imported graph replacement is one undoable command.

## Engineering evidence

- Property-generated DAGs round-trip exactly; invalid types, cardinality,
  duplicates, and cycles reject before mutation.
- Multi-node duplication creates new IDs and preserves only internal selected
  edges. Position, size, z-order, authored states, edges, and viewport contract
  serialize deterministically.
- A 300-node/299-edge document validates well below 500 ms in the domain test.
- Production chunks are split by runtime boundary; no output chunk exceeds 190
  kB before compression and the build emits no chunk warning.

## Actual-app UX evidence

Microsoft Edge journeys prove pointer and all-keyboard authoring, valid and
invalid edge paint, download/import of the exact generated artifact, search,
outline, pointer resize, command-menu focus, dialog focus restoration, geometry,
delete/undo recovery, and 300 rendered nodes. The 300-node Home event-to-paint
sample remains below 100 ms, the focused node is visible and hit-testable, open
dialogs have zero axe violations, and screenshots are retained for every material
state.

M3 local persistence is now allowed to build on the frozen graph and workflow
contracts. Processing milestones remain blocked on their declared dependencies.