# SPIKE-006 PNG Envelope

## Status

Pass for metadata architecture.

## Commands and raw result

```text
npm run test -- src/workflow/pngEnvelope.test.ts
npx playwright test tests/e2e/m1-browser-spikes.spec.ts
```

Unit evidence passes valid round-trip, stripped metadata, corrupt chunk CRC, and
oversized chunk declaration before allocation. Edge independently decodes valid,
stripped, and corrupt-metadata PNGs to the identical visible pixel
`[255,255,0,127]`; corrupt metadata returns a workflow warning without blocking
pixel import.

## Decision and fallback

Accept bounded compressed iTXt after IDAT and before IEND, with CRC, envelope
limits, deflate, SHA-256, and schema validation in that order. Metadata failure
never blocks pixels. Sidecar workflow JSON remains the interoperable fallback.
See `ADR-007-png-envelope.md`.