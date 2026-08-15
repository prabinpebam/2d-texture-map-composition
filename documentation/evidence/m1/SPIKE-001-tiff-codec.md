# SPIKE-001 TIFF Codec

## Status

Fail. TIFF remains hidden.

## Command and raw result

Package metadata was queried with direct npm against the repository-configured
Microsoft feed. No package was installed.

| Candidate | Feed result | Maintenance and capability result |
| --- | --- | --- |
| `utif` 3.1.0 | Available, MIT, 63,999 unpacked bytes | Last modified 2019-06-18; exposes encoding but its public RGBA conversion is 8-bit and does not establish required 16-bit RGBA output. |
| `geotiff` 3.0.5 | Available, MIT, 3.8 MB unpacked | Maintained browser decoder with typed 8/16-bit rasters; no required general TIFF encoder. |
| `tiff` 7.1.3 | Available, MIT, 136,306 unpacked bytes | Maintained decoder; no required general TIFF encoder. |
| `@jsquash/tiff`, `tiff-wasm` | Unavailable on managed feed | Cannot be selected in this environment. |

The pass condition requires a maintained permissive browser dependency that
encodes both 8- and 16-bit RGBA TIFF and survives independent decoders. No
candidate reached the encode step.

## Decision and fallback

Do not add a TIFF dependency or expose TIFF import/export. Keep the codec adapter
boundary and PNG/JPEG P0 behavior. Reopen only when a maintained feed-available
encoder establishes 8/16-bit RGBA, bounded browser memory, and two-decoder
interoperability. See `ADR-005-tiff-codec.md`.