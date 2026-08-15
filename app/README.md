# TextureFlow App

React and TypeScript application for the 2D texture-map composition workspace.
The implementation contract is in the repository `documentation/` directory.

## Prerequisites

- Node.js 24 or the repository-selected compatible version.
- Direct npm executable. Do not use Corepack in this managed environment.
- Microsoft Edge for the mandatory local Playwright UX gate.

The root `.npmrc` pins npm to:

```text
https://packagefeedproxy.microsoft.io/npm/
```

Do not retry package operations against `registry.npmjs.org`.

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
