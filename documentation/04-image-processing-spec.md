# Image Processing and Node Contract

## 1. Purpose

This document defines observable computation. A CPU reference implementation and
every accelerated backend must satisfy this contract. UI labels do not define
math; stable algorithm IDs, versions, equations, fixtures, and tolerances do.

## 2. Coordinates, Extents, and Numbers

- Pixel coordinates start at `(0,0)` at the top-left. `x` increases right and
  `y` increases down.
- A raster extent is positive integer `width x height`. Pixel centers are at
  `(x + 0.5, y + 0.5)`.
- Canonical scalar and vector channels are IEEE-754 `float32`. Accumulations that
  materially depend on order use `float64` in the reference backend.
- Inputs containing NaN or infinity are invalid. Kernels must not publish NaN or
  infinity. Division by zero follows the mode-specific branch below.
- Intermediate color may exceed `[0,1]`; masks, alpha, and serialized preview
  values are clamped to `[0,1]` at their declared boundaries.
- Unless stated otherwise, sampling outside the extent clamps to the nearest edge.

## 3. Canonical Data Types

| Type ID | Representation | Invariants |
| --- | --- | --- |
| `image.rgba.linear-srgb.f32.v1` | `R,G,B,A` float32 planes or interleaved tile | RGB is linear-sRGB; alpha is straight and linear; alpha in `[0,1]`; public pixels with alpha `<=1e-7` are transparent black. |
| `mask.scalar.f32.v1` | one float32 channel | Value in `[0,1]`; 0 excludes and 1 includes. |
| `height.scalar.f32.v1` | one float32 channel | Value normally in `[0,1]`; relative, unitless relief. |
| `normal.xyz.f32.v1` | three float32 channels | Unit vector in image tangent space; neutral is `(0,0,1)`. |
| `color.linear-srgb.f32.v1` | four floats | Linear-sRGB plus straight alpha. |
| `light.parallel.v1` | structured value | Unit vector toward light, finite intensity, linear tint. |
| `absent.v1` | typed sentinel | Carries source node, reason, and diagnostic. |

Ports accept exact types or registered, explicit conversions. No implicit Color
Image-to-Mask, Height-to-Normal, or scalar-to-color edge exists; the owning node
performs and serializes that interpretation.

## 4. Import Normalization

1. Verify signature, dimensions, and budgets before full allocation.
2. Decode and apply orientation exactly once.
3. Resolve source color space in priority order: explicit node override, embedded
   profile/recognized metadata, then sRGB for untagged content.
4. Convert color samples to linear-sRGB float32 without applying a transfer
   function to alpha.
5. Convert source alpha to straight alpha if the decoder supplies premultiplied
  data. At alpha `<=1e-7`, RGB becomes 0 to maintain the canonical invariant and
  prevent hidden source data leaking through final exports. Kernels may retain
  premultiplied working values internally, but every published tile and export
  restores transparent black at this boundary.
6. Record source digest, encoded dimensions, oriented dimensions, profile
   decision, bit depth, alpha presence, and decoder/normalization version.

Color conversion uses D50/D65 Bradford chromatic adaptation and matrices from
CSS Color Level 4. Gamut clipping does not occur during import. Unsupported or
malformed profiles produce a warning and require explicit sRGB fallback.

## 5. Mask Extraction

For canonical linear RGB `(r,g,b)` and alpha `a`:

| Source | Value |
| --- | --- |
| Luminosity | `clamp01(0.2126r + 0.7152g + 0.0722b)` |
| Alpha | `a`, or `1` when the source has no alpha |
| Red | `clamp01(r)` |
| Green | `clamp01(g)` |
| Blue | `clamp01(b)` |

Invert maps `m` to `1-m`. Extraction precedes inversion. Channel masks use
linearized samples by design; a future encoded-channel compatibility option must
use a different algorithm ID.

## 6. Resampling Contract

### 6.1 Geometry

Destination pixel center `(xd, yd)` maps to source:

$$
x_s = \frac{x_d + 0.5}{W_d}W_s - 0.5, \qquad
y_s = \frac{y_d + 0.5}{H_d}H_s - 0.5
$$

Separable kernels normalize contributing weights to sum to 1. For minification,
kernel support expands by the reciprocal scale so source energy is integrated
rather than point-sampled. A no-op extent returns the input identity/hash.

### 6.2 Catalog v1

| Algorithm ID | Kernel / parameters | Base support |
| --- | --- | --- |
| `nearest.v1` | nearest center, ties toward lower coordinate | 0.5 |
| `box-area.v1` | exact source-pixel area overlap | scale-dependent |
| `triangle.v1` | `max(0, 1-abs(x))` | 1 |
| `hermite.v1` | cubic Hermite, `B=0,C=0`, no negative lobe | 1 |
| `bspline.v1` | cubic `B=1,C=0` | 2 |
| `catmull-rom.v1` | cubic `B=0,C=1/2` | 2 |
| `mitchell.v1` | Mitchell-Netravali cubic `B=1/3,C=1/3` | 2 |
| `gaussian.v1` | `exp(-x^2/(2sigma^2))`, `sigma=0.5` | 2 |
| `lanczos2.v1` | `sinc(x)sinc(x/2)` | 2 |
| `lanczos3.v1` | `sinc(x)sinc(x/3)` | 3 |
| `lanczos4.v1` | `sinc(x)sinc(x/4)` | 4 |

`sinc(0)=1`; otherwise `sinc(x)=sin(pi*x)/(pi*x)`. Cubic kernels use the
standard Mitchell-Netravali piecewise cubic equation identified by `B,C`.

### 6.3 Type-specific handling

- Color: premultiply linear RGB by alpha, filter four channels, then
  unpremultiply. If filtered alpha is `<= 1e-7`, output transparent black.
- Mask/height: filter scalar directly, then clamp to `[0,1]`.
- Normal: filter XYZ components, then normalize. A near-zero vector becomes
  neutral `(0,0,1)` and emits a diagnostic counter.
- Auto preset resolves to `box-area.v1` when either axis shrinks and
  `mitchell.v1` otherwise. Pixel Art resolves to nearest; Smooth to Mitchell;
  Sharp to Lanczos3.

## 7. Normal and Height Standardization

### 7.1 Encoded normal input

For normalized source channels `(r,g,b)`:

$$
x = 2r-1, \qquad y = s_y(2g-1)
$$

where `s_y=1` for `+Y` and `-1` for `-Y`. Optional X/Y flips apply next. If
`reconstructZ` is enabled:

$$
z = \sqrt{\max(0,1-x^2-y^2)}
$$

otherwise `z=2b-1`. Apply channel swizzle before decode, multiply `x,y` by
strength, then normalize `(x,y,z)`. If length is below `1e-7`, use neutral.

Auto suggestion samples an evenly distributed bounded grid and may suggest
normal interpretation only when blue-channel mean, vector-length distribution,
and channel ranges pass versioned thresholds. It never changes authored settings
without confirmation.

### 7.2 Height derivation

An arbitrary color image becomes height using mask extraction rules, defaulting
to luminosity. For clamped neighboring heights and pixel spacing 1:

$$
d_x = \frac{h(x+1,y)-h(x-1,y)}{2}, \qquad
d_y = \frac{h(x,y+1)-h(x,y-1)}{2}
$$

$$
N = \operatorname{normalize}(-s d_x,-s d_y,1)
$$

where strength `s` defaults to 2 and ranges `[0,32]`. The P1 Sobel option uses
the normalized 3x3 Sobel derivative and a distinct algorithm ID. Roughness as
height first applies optional invert (default off) and the same path.

## 8. Parallel Lights and Shading

Azimuth is clockwise from image-up: 0 degrees is north, 90 east. Elevation is 0
at the image plane and 90 toward the viewer. The unit vector from surface toward
the light is:

$$
L=(-\sin a\cos e, -\cos a\cos e, \sin e)
$$

using radians. The default NW light has azimuth 315 degrees, elevation 45
degrees, intensity 1, white tint, and tint mix 0. Its rays therefore travel
toward southeast.

Tint mix `t` creates linear light color `Lc = mix((1,1,1), tint, t)`. For a
normal `N`, each light contributes:

$$
D_i = I_i\max(0,N\cdot L_i)Lc_i
$$

The launch material shader is diffuse-only:

$$
C_{lit}=C_{base}\left(A + K_d\sum_i D_i\right)
$$

with ambient `A=0.35` and diffuse `Kd=0.65` by default. Values remain extended
until preview/export. Alpha is unchanged except by the opacity mask. With no
explicit light edges, the default light is used. With explicit edges, muted
lights are removed; if none remain, the output is unlit base color, not the
implicit default. This rule is represented in the serialized input state.

## 9. Color Correction v1

Operations occur in this order: temperature/green-magenta tint, hue, saturation,
then color tint. Alpha is unchanged.

1. Temperature maps normalized `p in [-1,1]` to CCT
   `T = 6504 * 2^(-p*1.7)`, clamped to `[2000,12000]` K. Convert CCT to an xy
   chromaticity using the standard piecewise Planckian-locus approximation,
   convert xyY (`Y=1`) to XYZ, and Bradford-adapt from D65 to that white.
2. Green-magenta tint maps `q in [-1,1]` to an Oklab `a` offset `-0.05q`, then
   returns to linear-sRGB.
3. Hue converts to Oklch and adds degrees modulo 360. Achromatic pixels preserve
   chroma zero.
4. Saturation `s in [-1,1]` multiplies Oklch chroma by `max(0,1+s)`.
5. Selected tint color mixes in linear-sRGB using percentage `t in [0,1]`:
   `Cout=(1-t)C+tTint`.

Out-of-gamut intermediate values are retained. Preview/export applies the chosen
gamut map. The implementation must copy the CCT-to-xy coefficients and Bradford
matrices into an ADR with golden vectors before code freeze; changing them bumps
the algorithm version.

## 10. Brightness Correction v1

Controls `highlights`, `shadows`, `whites`, and `blacks` are in `[-1,1]`;
exposure is in `[-8,8]` EV. Compute source luminance `Y` and smoothstep
`S(a,b,x)=t^2(3-2t)`, where `t=clamp01((x-a)/(b-a))`:

$$
w_s=(1-S(0,0.5,Y))^2,\quad w_h=S(0.5,1,Y)^2
$$

$$
w_b=1-S(0,0.25,Y),\quad w_w=S(0.75,1,Y)
$$

$$
g=2^{exposure+1.5(shadows\,w_s+highlights\,w_h)+
(blacks\,w_b+whites\,w_w)}
$$

Output RGB is `C*g`; alpha is unchanged. All-zero controls are exact identity.
Extended values are retained for downstream operations.

## 11. Blending and Alpha

### 11.1 General operation

Foreground is source `Cs,as`; background is backdrop `Cb,ab`. Blend functions
operate on straight RGB. The W3C source-over result is:

$$
C_r=(1-a_b)C_s+a_bB(C_b,C_s)
$$

$$
c_o=a_sC_r+a_bC_b(1-a_s),\qquad
a_o=a_s+a_b(1-a_s)
$$

Straight output is `Co=co/ao`, or transparent black when `ao<=1e-7`. Node
opacity and mask multiply `as` before blending. Standard catalog default blend
space is encoded sRGB for compatibility; users may select linear-sRGB. The
choice is serialized.

### 11.2 Standard catalog v1

The normative formulas are W3C Compositing and Blending Level 1 for:

`normal`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`,
`color-burn`, `hard-light`, `soft-light`, `difference`, `exclusion`, `hue`,
`saturation`, `color`, and `luminosity`.

Non-separable modes use the W3C `Lum`, `Sat`, `SetLum`, `SetSat`, and
`ClipColor` helper formulas, not an HSL-library substitute.

### 11.3 Creative extension catalog v1

Per channel, with values clamped after `B`:

| Mode ID | Formula `B(Cb,Cs)` |
| --- | --- |
| `linear-dodge.v1` | `min(1,Cb+Cs)` |
| `linear-burn.v1` | `max(0,Cb+Cs-1)` |
| `subtract.v1` | `max(0,Cb-Cs)` |
| `divide.v1` | `Cs<=1e-7 ? 1 : min(1,Cb/Cs)` |
| `vivid-light.v1` | `Cs<=0.5 ? burn(Cb,2Cs) : dodge(Cb,2(Cs-0.5))` |
| `linear-light.v1` | `clamp01(Cb+2Cs-1)` |
| `pin-light.v1` | `Cs<=0.5 ? min(Cb,2Cs) : max(Cb,2(Cs-0.5))` |
| `hard-mix.v1` | `vividLight(Cb,Cs)<0.5 ? 0 : 1` |

`darker-color.v1` and `lighter-color.v1` compare W3C luminosity of whole RGB
triples and return one whole color; ties return the background.

## 12. Canvas and Dimension Resolution

For Merge v1, output extent is `max(widthA,widthB) x max(heightA,heightB)`.
Each image is center-aligned using integer offset `floor((Wout-Win)/2)` and the
equivalent Y offset. Pixels outside an input are transparent black. P1 alignment
adds explicit start/center/end offsets without changing this default.

Material output extent is the base color extent. Optional mask/relief inputs with
different extents are sampled to base extent using their upstream data type’s
Auto resampling contract and emit a warning. Explicit Resize is recommended when
the mismatch is intentional.

## 13. Representative Color

For pixels with straight linear RGB `Ci` and alpha `ai`:

$$
C_{mean}=\frac{\sum_i a_iC_i}{\sum_i a_i}
$$

Use float64 pairwise accumulation over deterministic tile and scanline order. If
`sum(alpha)<=1e-7`, the result is absent. Convert mean to encoded sRGB for hex and
CSS HSL. Hex quantizes by `round(clamp01(c)*255)` and serializes `#RRGGBB`.

For target comparison:

- `deltaH = ((Hsource-Htarget+540) mod 360)-180` when both hues exist.
- `deltaS = Ssource-Starget`; `deltaL = Lsource-Ltarget` in percentage points.
- CIEDE2000 uses D50 Lab and the validated Sharma/W3C reference vectors.

## 14. Preview and Export

- Interactive preview evaluates a maximum 1024-pixel long edge by default, while
  preserving aspect ratio and using the same algorithms.
- Settled preview may refine to 2048 when memory permits. Export always evaluates
  the requested full extent from source, never upscales the preview cache.
- Mask grayscale maps `m` to `(m,m,m,1)`. False color is display-only and never
  changes download data.
- Preview gamut-maps to display sRGB initially. P1 may expose Display-P3 after
  browser conformance.
- PNG launch export is 8-bit straight RGBA sRGB with an sRGB color marker. JPEG
  composites in linear light over the selected background, encodes sRGB, and
  uses user quality. TIFF details remain gated by SPIKE-001.
- Final quantization may use deterministic ordered dithering for 8-bit export;
  no-dither and algorithm version are serialized in export settings.

## 15. Tile Semantics

Default logical tile size is 512x512. A kernel requests a halo equal to the
ceil of its effective support; gradient normals request one pixel. Tiles are
cropped to their core before caching. Results must be invariant to tile size and
scheduling order within the exact TypeScript/Rust-WASM CPU or GPU tolerance for
that output class below; tiling receives no additional error allowance.

## 16. Conformance Tolerances

| Comparison | Tolerance |
| --- | --- |
| Scalar algebra and masks | absolute error `<= 1e-6` TypeScript/Rust-WASM CPU; `<= 2e-5` GPU |
| Color kernels before quantization | max channel absolute error `<= 2e-5` TypeScript/Rust-WASM CPU; `<= 1e-4` GPU |
| Normal vectors | angular error `<= 0.02` degrees TypeScript/Rust-WASM CPU; `<= 0.1` degrees GPU |
| 8-bit export | exact bytes for deterministic CPU encoder fixtures, otherwise decoded channels within 1 code value |
| Representative color | CIEDE2000 `<= 0.01` from reference |

Golden tests include transparent RGB, alpha edges, odd dimensions, one-pixel
extents, no-op filters, high-frequency rings, flat/checker gradients, every blend
branch boundary, normal convention flips, all-muted lights, out-of-gamut color,
and tile-boundary continuity.

## 17. Node Contract Matrix

| Node | Inputs | Outputs | Pass-through for bypass | Cache parameters |
| --- | --- | --- | --- | --- |
| Load Image | asset reference | image or mask | none | asset digest, interpretation, normalization versions |
| Material | base image/color; optional mask; optional normal/height; lights[] | image | base image | shading controls, fallback-light state |
| Resize | image/mask/height/normal | same type | input | extent, kernel ID/version, edge mode |
| Color Correction | image; optional mask | image | image | ordered controls, algorithm version |
| Brightness Correction | image; optional mask | image | image | controls, algorithm version |
| Merge | image A, image B; optional mask/relief/lights | image | foreground | layer order, mode, opacity, canvas policy |
| Light | none | light | none | direction, intensity, tint/mix |
| Image to Single Color | image; optional target color parameter | color + metrics | none | reduction and difference versions |
| Image Preview | image or mask | export artifact on command | input | preview mode/export settings |

All node serialization includes `type`, `typeVersion`, `algorithmVersion`,
parameters, authored state, bounds, and stable ID. Unknown parameters are not
silently dropped during read-only opening.

An absent value connected to an optional input is treated exactly as a
disconnected optional input: opacity/mask defaults to identity and relief is
skipped. Absent entries in variadic inputs are omitted while preserving the order
of remaining entries. An absent value on a required input invalidates the node.
Load Image, Light, and Image to Single Color disable bypass because no input has
the same type and meaning as their output. Every other node enables bypass with
the pass-through listed above.

## 18. Processing Definition of Done

This contract closes when every formula has independent numeric fixtures, each
node has normal/invalid/boundary/cancel cases, CPU and any accelerated backend
pass the same conformance suite, and serialized algorithm versions recreate
equivalent output without relying on browser canvas blend behavior.