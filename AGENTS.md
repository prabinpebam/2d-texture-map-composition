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