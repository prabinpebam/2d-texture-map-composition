# ADR-002: Canonical Pixels and Alpha

- Status: Accepted
- Evidence: `fixtures/vectors/scalar-reference-v1.json`

Use linear-sRGB float32 with straight alpha at public boundaries. Premultiply
only for filtering/compositing internals. Publish alpha at or below `1e-7` as
transparent black. Reject non-finite values and canonicalize signed zero. This
prevents hidden RGB leakage and gives every backend one numeric oracle.