# M2 Node Commands

## Outcome

Authored node movement, duplicate, delete, bypass, mute, lock, undo, and redo now
share one canonical command store. Source nodes reject bypass, locked nodes reject
movement and deletion, and selection remains ephemeral.

## Engineering evidence

Six command-store tests prove movement, lock enforcement, non-overlapping
duplication placement, state guards, deletion, and undo. UI, lint, typecheck, and
build checks remain clean.

## Actual-app UX evidence

`npx playwright test -g "keyboard user can move lock and duplicate a node"`

In Microsoft Edge, a keyboard user moves a selected node by 10 px, mutes and
locks it with conflict-free shortcuts, confirms movement is blocked while locked,
unlocks from the toolbar, and duplicates it. The two 240 px nodes do not overlap,
the duplicate receives selection, and visible state/count feedback is retained in
`m2-node-commands.png`.