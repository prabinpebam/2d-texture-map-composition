# M3 Lifecycle and Migration

## Outcome

Local project lifecycle now distinguishes reversible trash from permanent
deletion, offers an independent writable copy to a read-only tab, and upgrades
IndexedDB v1 data to v2 without losing authored records.

## Product evidence

- A non-active project moves to Trash, visibly remains recoverable, restores to
  the local list, and only then can be permanently deleted.
- A read-only tab opens the current graph as `Untitled workflow copy` while the
  original writer remains active. The copy gets a new project ID and its workflow
  JSON embeds that same new ID, preventing revision-stream aliasing.
- Active projects remain protected from trash and permanent-delete actions.

## Migration evidence

Microsoft Edge creates a native IndexedDB v1 fixture containing a project and
snapshot, then opens it through the current Dexie schema. The database upgrades
to version 2, preserves both records and all six v1 stores, and adds `previews`
and `settings`. Raw migration evidence is retained as a Playwright JSON
attachment.

The project initialization cache remains concurrent-only: settled entries are
evicted so reopen and project switching always read the latest snapshot.