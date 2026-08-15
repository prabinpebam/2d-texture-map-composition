# M2 Workflow Round-Trip UX

## Outcome

The existing project toolbar now downloads graph workflow v1 and imports a user-
selected workflow only after JSON Schema and semantic validation. Import replaces
the authored graph as one undoable command; validation failure publishes a local
status and leaves the open graph unchanged. Export revokes its Blob URL after the
download starts.

## Actual-app evidence

Microsoft Edge creates a Load Image node, downloads the app-produced
`untitled.textureflow.json`, opens a fresh app page, imports that exact downloaded
file, and restores the visible node with `Imported 1 nodes and 0 edges` feedback.
The retained screenshot is `m2-workflow-roundtrip.png`.

Component accessibility remains at zero axe violations after adding the labeled
hidden file picker.