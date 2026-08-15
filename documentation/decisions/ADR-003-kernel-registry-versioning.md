# ADR-003: Kernel Registry and Versioning

- Status: Accepted
- Evidence: scalar and WASM conformance suites

Address kernels by stable algorithm ID and version, with canonical typed inputs,
parameters, output type, halo, and tolerance. Every backend consumes independent
scalar fixtures; no accelerated backend creates expected output. A semantic math
change creates a new version and retains old behavior for saved workflows.