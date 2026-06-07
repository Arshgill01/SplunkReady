# Move 132 - Public Package Currentness Proof

## Intent

Close the public-package probability cap without overclaiming. Judges need a
no-clone npm command, but MCP/SAIA judging also needs the public package to
contain the current `splunkready mcp` entrypoint and hosted-model evidence. This
move adds a registry-backed audit that separates those two facts.

## Scope

- Add `npm run audit:public-package-currentness`.
- Query the public npm registry for the latest published `splunkready` version.
- Run the latest published `judge-proof` from a clean temp folder and require
  `mutation: false`.
- Try to initialize the latest published `splunkready mcp` stdio server.
- Write a secret-free currentness report into tracked submission evidence.
- Update README, Devpost copy, claim ledger, and submission-copy guards.

## Verification

- `npx tsc --noEmit`
- `npx vitest run tests/scripts/public-package-currentness.test.ts tests/scripts/npm-release-preflight.test.ts`
- `npm run audit:public-package-currentness -- --out submission-evidence/public-package-currentness`
- `npx vitest run tests/scripts/submission-copy-audit.test.ts`
- `npm run audit:submission-copy`
- `npm run check`
- `git diff --check`

## Result

The audit reports the current public registry state honestly:

- npm latest is still `splunkready@0.1.0`.
- local source is `0.1.1`.
- published `splunkready@0.1.0 judge-proof` returns `PASS` with
  `mutation: false`.
- published `splunkready@0.1.0 mcp` is `BLOCKED` because that version does not
  include the MCP entrypoint.

Do not claim package-installed MCP/SAIA support through `splunkready@latest`
until `npm view splunkready version --json` reports the current source version
and this audit returns `CURRENT`.
