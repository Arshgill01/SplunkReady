# Move 122 - Next Package Release Alignment

## Goal

Prepare the repository for the next public npm package smoke after the user
published `splunkready@0.1.0`, without republishing from the agent session.

## Scope

- Bump source package metadata to the next unpublished patch version.
- Update README, Devpost copy, and claim ledger judge commands to reference the
  next version that will contain the current MCP/SAIA work after publish.
- Update the submission-copy guard so stale published-package commands fail the
  canonical check.
- Run package release preflight to prove registry readiness for the next
  version.

## Boundaries

- Do not run `npm publish`.
- Do not claim `splunkready@0.1.1` is published until the user publishes it.
- Do not read, source, print, or commit `.splunkready*` / `.env*` secret values.
- Do not mutate Splunk.
- Do not use subagents.

## Verification

- `npm run audit:npm-release-preflight -- --require-ready`
- `npm run audit:package-installability`
- `npm run audit:submission-copy`
- `npm run check`
