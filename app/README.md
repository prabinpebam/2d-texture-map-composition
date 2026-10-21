# TextureFlow App

React and TypeScript application for the 2D texture-map composition workspace.
The implementation contract is in the repository `documentation/` directory.
For the introduction, live demo, and first workflow, see the
[project README](../README.md).

## Prerequisites

- Node.js 24.15 or newer in the 24.x line.
- Rust 1.93.1 with the `wasm32-unknown-unknown` target (see `rust-toolchain.toml`).
- Direct npm executable. Do not use Corepack in this managed environment.
- Microsoft Edge for the mandatory local Playwright UX gate.

The root `.npmrc` pins npm to:

```text
https://packagefeedproxy.microsoft.io/npm/
```

Do not retry package operations against `registry.npmjs.org`.

ESLint stays on the 9.x line supported by `eslint-plugin-jsx-a11y`. Keep their
peer dependency ranges compatible so a clean `npm ci` works without overrides.

## Local Commands

From `app/`:

```powershell
npm install
npm run dev
npm run check:fast
npm run test:e2e
npm run check
```

`npm run check` is the milestone gate. It runs formatting, lint, unit and
accessibility tests, the production build, then the Playwright UX evaluation.
Playwright starts the actual app on a local server, opens Microsoft Edge, drives
the intended user task with real interactions, and retains browser evidence under
the ignored `test-results/` directory.

Functional tests support implementation correctness. They do not replace the UX
evaluation, and a milestone is not complete if Playwright cannot open the actual
app or the user cannot complete the intended task.

## GitHub Pages

```powershell
npm run build:pages
npm run test:pages
```

The Pages build uses `/2d-texture-map-composition/` instead of the local root.
Its dedicated Playwright configuration starts a production preview on port
4175, verifies WASM and storage readiness, and exercises image import, error
recovery, node connection, pixel rendering, and save/reload. Set `PAGES_URL` to
the published URL (including its trailing slash) to run against the live site
instead. CI uses Chromium; local checks use Microsoft Edge.

The repository's Pages workflow runs these checks before deploying `dist/`.
See the [deployment guide](../README.md#deployment) for repository settings.
