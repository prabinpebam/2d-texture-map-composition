# M2 Graph Foundation

## Outcome

The first graph-authoring vertical slice is complete. A user can inspect a node
template, add a canonical typed node to React Flow, see selection and node count,
delete the selected node, and undo the deletion in the actual Edge application.

## Domain evidence

- Canonical node defaults include stable ID, type, label, position, 240x128 size,
  z-order, bypass, mute, and lock state.
- The type registry defines input/output data types and cardinality.
- Connection validation accepts compatible ports and rejects incompatible types,
  duplicate/non-variadic occupancy, missing entities, and cycles before mutation.
- Add and delete are authored commands with undo/redo; selection is ephemeral and
  does not enter history.

## UX evidence

`npx playwright test -g "user can add delete and restore a graph node"`

Microsoft Edge proves visible node paint at the specified scale, graph-contained
geometry, center hit testing, selected state, node-count feedback, delete, and
undo recovery. The retained screenshot is `m2-add-node.png`.

## Remaining M2 scope

Typed edge authoring, move/resize coalescing, duplicate, lock/bypass/mute, graph
keyboard composite behavior, dialogs, serializer/schema round-trip, and the
300-node stress gate remain open. M2 is not closed by this slice.