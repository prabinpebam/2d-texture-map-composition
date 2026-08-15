# SPIKE-004 Color Import

## Status

Partial pass for browser capability; fail for canonical wide-gamut import.

## Command and raw result

`npx playwright test tests/e2e/m1-browser-spikes.spec.ts`

In Edge, an untagged PNG and the same PNG with an explicit sRGB chunk both decode
to `[255,255,0,127]`. An sRGB canvas PNG round-trips `[255,128,0,255]` exactly.
A Display-P3 canvas PNG carries `iCCP`; its pre-encode sample `[255,127,0,255]`
decodes through the default canvas to `[255,117,0,255]`, proving profile-aware
transformation but not exposing canonical linear-sRGB values consistently.

## Decision and fallback

Accept untagged-as-sRGB and explicit sRGB browser decode for the launch path.
Do not claim wide-gamut canonical import from browser canvas. Preserve profiles
and overrides at the codec boundary and require a reviewed ICC conversion path
before Display-P3 product claims. See `ADR-008-color-conversion.md`.