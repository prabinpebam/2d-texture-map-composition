# M3 Autosave Foundation

## Outcome

The local project repository now owns IndexedDB v1 project, snapshot, asset,
project-asset, checkpoint, and lease stores. Graph commands autosave after a 500
ms coalescing window and restore the current authored graph after reload without
creating undo history.

## Integrity and recovery evidence

- Workflow SHA-256 is computed outside the write transaction.
- A complete snapshot insert, project current-pointer/revision update, and
  checkpoint deletion commit atomically.
- Opening verifies snapshot bytes in descending revision order. A deliberately
  corrupted current snapshot remains stored and reported while revision 1 is
  restored from its valid digest.
- Identical asset bytes imported under two names produce one content-addressed
  asset record.

## Actual-app UX evidence

Microsoft Edge adds a Load Image node, waits until the actual IndexedDB snapshot
contains that authored type, verifies the complete revision pointer and digest,
reloads, and restores the visible node with `Saved locally`. Hydration leaves Undo
disabled. Evidence is retained in `m3-autosave-reload.png` and the repository
recovery JSON attachment.

## Remaining M3 scope

Project browser/create/rename/delete, explicit Save, persistence request and
quota meter, checkpoint/pagehide path, preview reclamation, lease renewal/takeover,
read-only conflict UX, migrations, and full recovery controls remain open. M3 is
not closed by this foundation milestone.