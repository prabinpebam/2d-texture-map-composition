# ADR-007: PNG Workflow Envelope

- Status: Accepted
- Evidence: `documentation/evidence/m1/SPIKE-006-png-envelope.md`

Embed optional workflow JSON in a compressed iTXt chunk after IDAT and before
IEND. Check chunk bounds and CRC before decoding, then envelope bounds, deflate,
length, ratio, SHA-256, schema, and graph semantics. Any metadata failure becomes
a warning while pixels continue to import. Sidecar JSON is the fallback.