# M3 Project Browser

## Outcome

Users can browse local projects, create and open an isolated project, rename it
inline, and delete non-active projects. The active project cannot be deleted from
the browser. Each project has an independent autosave revision stream and graph
hydration clears history.

## Repository evidence

Rename validates the 1-200 character name contract. Delete atomically removes the
project, its snapshots, project-asset links, checkpoint, and lease while retaining
shared content-addressed assets.

## Actual-app evidence

Microsoft Edge saves a Load Image graph in the default project, creates and opens
a second project, saves a Light graph there, renames the second project, creates
and deletes a disposable project, then reopens the default. Only the Load Image
graph returns; the Light node remains isolated. Snapshot content, not transient
status text, is the switch completion oracle. The retained screenshot is
`m3-project-browser.png`.

Project initialization promises now deduplicate only concurrent opens and are
evicted after settlement, ensuring every later switch reads the latest snapshot.