# ADR-005: TIFF Codec

- Status: Rejected pending replacement evidence
- Evidence: `documentation/evidence/m1/SPIKE-001-tiff-codec.md`

No managed-feed candidate establishes maintained browser encoding for both 8-
and 16-bit RGBA. Do not install a decoder-only dependency or expose TIFF. Keep a
replaceable codec adapter and reopen only with bounded encoding plus two-decoder
interoperability. PNG and JPEG remain the launch export formats.