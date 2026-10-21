# TextureFlow

A local-first, node-based workbench for composing 2D texture maps in your browser.
Connect image inputs, adjustments, and previews on a visual canvas, then run the
workflow to inspect the result.

**[Open the live demo](https://prabinpebam.github.io/2d-texture-map-composition/)**
-- no installation, account, or image upload required.

[![Deploy GitHub Pages](https://github.com/prabinpebam/2d-texture-map-composition/actions/workflows/pages.yml/badge.svg)](https://github.com/prabinpebam/2d-texture-map-composition/actions/workflows/pages.yml)

## Try it

Use a current desktop browser; Microsoft Edge and Chromium are tested.

1. Open the demo and wait for **WASM compute** and **Storage verified** in the
   status bar.
2. Choose **Import images** and select a small PNG or JPEG. A **Load image** node
   appears on the canvas.
3. Select **Image preview** in the node library, then **Add to canvas**.
4. Drag the load node's **Image output** socket to the preview's **Image input**.
5. Click **Run workflow**. Close the run history to inspect the rendered preview.
6. Change the load node's output to a mask, choose a channel, and run again.
   For a longer chain, insert resize, brightness, or color-correction nodes.
7. Click **Save project**. Reloading restores the graph and its source assets;
   run it again to regenerate previews.

## What works today

- Typed graph connections, inline node controls, search, pan/zoom, undo/redo,
  node resizing, and optional inspector.
- Local image import, channel-derived masks, resize, brightness, and color
  correction with worker-rendered previews.
- Explicit workflow execution, run history, and cached preview results.
- Browser-local projects, autosave, explicit saves, project copies, and
  multi-tab editing protection.
- Workflow JSON import/export and system, light, and dark themes.
- React/TypeScript UI and a Rust/WebAssembly compute kernel, with a scalar
  compatibility path.

**This is an experimental personal project, not a finished image editor.**
Some catalog nodes and output/export capabilities are still under development.
The catalog is not a promise that every planned processing chain is implemented.
See the [implementation handoff](documentation/12-continuation-handoff.md) and
[specifications](documentation/00-specification-index.md) for scope and status.

## Your files and privacy

Image processing and project storage run in your browser. There is no application
server receiving your images and no cloud project sync. GitHub Pages serves the
application's static files.

Projects belong to the browser profile and site origin where you create them.
Clearing site data, private browsing, storage eviction, or changing devices can
remove or hide them. Keep original image files and export important workflows.
Workflow JSON is not a portable backup of the source image files. Projects made
on localhost do not automatically appear on the hosted demo.

## Run locally

Prerequisites:

- Node.js 24.15 or newer in the 24.x line and an installed npm executable
  (no Corepack).
- Rust **1.93.1**, selected by [rust-toolchain.toml](rust-toolchain.toml), with
  the `wasm32-unknown-unknown` target.
- Microsoft Edge for local Playwright browser checks.

```powershell
git clone https://github.com/prabinpebam/2d-texture-map-composition.git
Set-Location 2d-texture-map-composition
rustup show
npm --prefix app ci
npm --prefix app run dev
```

Open the local URL printed by Vite. The dev command builds the WASM kernel first.
The repository's [.npmrc](.npmrc) selects the approved Microsoft npm feed; preserve
that registry when installing dependencies.

## Validate and build

```powershell
# Formatting, lint, unit tests, WASM checks, and production build
npm --prefix app run check:fast

# Full development-server browser suite (Playwright owns the server)
npm --prefix app run test:e2e

# Production build and browser smoke test at the GitHub Pages subpath
npm --prefix app run build:pages
npm --prefix app run test:pages
```

The Pages smoke test uses real browser input to import an image, connect nodes,
render and sample canvas pixels, recover from an invalid import, and save/reload.
Screenshots and traces are retained in the ignored `app/test-results/` directory.

## Deployment

The [Pages workflow](.github/workflows/pages.yml) runs on pushes to `master` and
can also be started manually from GitHub Actions. It builds Rust/WASM and the
frontend, runs supporting checks and the production browser smoke test, then
deploys only `app/dist` using GitHub's official Pages actions.

Repository **Settings > Pages > Build and deployment > Source** must be
**GitHub Actions**. The site is served at
<https://prabinpebam.github.io/2d-texture-map-composition/>.
No custom domain, backend, secrets, or cross-origin isolation headers are needed.
The production build includes the repository base path for scripts, workers,
and WASM. Local development continues to use `/`.

To smoke-test the published site with the same browser scenario:

```powershell
$env:PAGES_URL = 'https://prabinpebam.github.io/2d-texture-map-composition/'
npm --prefix app run test:pages
Remove-Item Env:PAGES_URL
```

## Repository map

| Directory                                     | Contents                                                         |
| --------------------------------------------- | ---------------------------------------------------------------- |
| [app](app/)                                   | React application, worker processing, storage, and browser tests |
| [crates/image-kernels](crates/image-kernels/) | Rust/WASM image kernels                                          |
| [documentation](documentation/)               | Product specifications, decisions, and milestone evidence        |
| [schemas](schemas/)                           | Workflow and evaluation JSON schemas                             |
| [fixtures](fixtures/)                         | Reference vectors and fixture manifests                          |

For development commands and browser-test details, see the
[app README](app/README.md). Bug reports and reproducible examples are welcome in
[GitHub Issues](https://github.com/prabinpebam/2d-texture-map-composition/issues).
