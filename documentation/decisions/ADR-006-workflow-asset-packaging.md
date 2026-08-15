# ADR-006: Workflow Asset Packaging

- Status: Accepted for format v1

Plain workflow JSON references assets by digest, name, media type, length, and
availability; it does not embed binary source bytes. Optional PNG metadata embeds
only bounded workflow JSON. Missing assets preserve graph structure and support
relink. A future package format requires a separate size, security, and usability
spike rather than expanding JSON with base64 assets.