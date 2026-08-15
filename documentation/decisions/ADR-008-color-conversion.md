# ADR-008: Color Conversion Boundary

- Status: Accepted with wide-gamut gate
- Evidence: `documentation/evidence/m1/SPIKE-004-color-import.md`

Treat untagged imports as sRGB and accept explicit sRGB browser decode for the
launch path. Do not use default canvas output as the canonical wide-gamut
conversion oracle. Preserve profile decisions and explicit overrides at the
codec boundary. Display-P3 claims require a reviewed ICC-to-linear-sRGB path and
cross-browser fixtures.