# SPIKE-007 Normal Heuristics

## Status

Fail for automatic suggestion enablement.

## Command and raw result

`npm run test -- src/processing/normalSuggestion.test.ts`

The versioned synthetic corpus distinguishes `suggest-normal`, `uncertain`, and
`not-normal`, avoids the included blue-photographic false positive, rejects
non-finite input, and samples at most 100 of 10,000 test pixels. Three tests pass.

## Decision and fallback

Four synthetic cases cannot establish documented confidence on a representative
image corpus. Keep manual normal interpretation and convention controls; do not
enable authored-state changes or automatic suggestions. Reopen with licensed or
repository-authored real normal/photo pairs and measured precision/recall. See
`ADR-012-normal-suggestion.md`.