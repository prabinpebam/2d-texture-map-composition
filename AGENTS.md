# Repository Instructions

## Package Registry

This workspace may run on a Microsoft-managed device that blocks direct access
to public npm registries.

- Use `https://packagefeedproxy.microsoft.io/npm/` for npm-compatible package
  metadata and packages.
- Configure the selected package manager to use that registry before any install,
  update, audit, or package lookup.
- Do not use Corepack to download, prepare, or resolve package-manager versions.
  Corepack still queries `registry.npmjs.org` even when npm and Yarn are configured
  for the Microsoft package feed.
- Do not set `COREPACK_NPM_REGISTRY` to the Microsoft package feed as a workaround.
  Corepack expects metadata endpoints that the feed does not expose.
- Invoke an already-installed npm or Yarn executable directly. If the required
  package manager is unavailable without Corepack, stop and report the blocker
  instead of falling back to a public registry.
- Keep package-manager configuration and lockfile resolution compatible with the
  Microsoft package feed. Never silently retry against `registry.npmjs.org`.

## Git Milestones

- Commit changes after every meaningful milestone once its focused validation and
  milestone exit checks pass.
- A meaningful milestone is an independently reviewable outcome such as a closed
  specification phase, validated project foundation, completed vertical feature
  slice, schema migration, or hardening/release gate.
- Before committing, inspect status and the staged diff so unrelated user changes
  are not included. Do not revert unrelated changes.
- Use a concise commit message that states the completed outcome.
- Do not amend, squash, push, create remote state, or dispatch remote automation
  unless the user explicitly requests it.

## Actual App UX Validation

- Validation and evaluation loops judge the actual user experience and whether a
  user can complete the intended task as expected. They are not functional code
  test loops.
- Every meaningful implementation milestone must be evaluated with Playwright by
  starting the actual application and opening it in a real target browser.
- Playwright must own the app instance, use real pointer/keyboard input, and prove
  the user goal, visible paint, layout, hit testing, feedback, and recovery state
  for the changed experience.
- Capture screenshots and relevant browser evidence. Canvas and bitmap features
  require nonblank paint and sampled semantic pixels/values when introduced.
- Unit, integration, schema, numeric, lint, typecheck, and build checks remain
  mandatory supporting engineering evidence, but none can substitute for UX
  validation of the actual app.
- If the intended user task cannot be completed in Playwright, the experience is
  not done even when all functional tests pass. If Playwright cannot open the
  actual app, the milestone remains incomplete and must not be committed as done.