# Move 126 - Published-Package Copy Hygiene

Status: implemented

## Goal

Remove public judge-path ambiguity after verifying that npm latest is still
`splunkready@0.1.0`, while the checked-out source is newer and includes the
MCP stdio entrypoint that is not yet in the published package.

## Scope

- Verify the actually published package version from npm.
- Smoke-test `npx -y splunkready@0.1.0 judge-proof --out ./judge-proof --json`
  from a clean temp folder.
- Verify published `splunkready@0.1.0` does not yet support `splunkready mcp`.
- Update README, Devpost copy, claim ledger, and submission-copy audit guards
  to cite the published `0.1.0` judge-proof path.
- Update MCP client-config resources to use source-clone `npm run mcp` until
  the next npm package release includes the MCP entrypoint.
- Regenerate MCP proof evidence and public demo artifacts.

## Boundaries

- Do not claim `splunkready@0.1.1` is published.
- Do not claim `splunkready@latest mcp` works until npm latest contains the MCP
  entrypoint.
- Do not mutate Splunk.
- Do not read, print, source, or commit secret env files.

## Verification

- `npm view splunkready version --json`
- Clean temp-folder `npx -y splunkready@0.1.0 judge-proof --out ./judge-proof --json`
- Clean temp-folder `npx -y splunkready@0.1.0 mcp` initialize attempt, expected
  to fail with `Unknown command mcp`
- `npx tsc --noEmit`
- `npx vitest run tests/mcp/server.test.ts tests/cli/flow.test.ts tests/scripts/submission-copy-audit.test.ts`
- `npm run mcp-proof`
- `node dist/src/cli.js mcp-proof --out submission-evidence/mcp-proof --json`
- `npm run public-demo:build`
- Playwright verification of the public MCP proof route and generated artifact
  JSON
