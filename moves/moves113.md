# Move 113 - MCP Hosted Model Access Check

## Goal

Make the SAIA / hosted-model track visible through the MCP surface so an MCP
client can prove hosted-model access without making SAIA authoritative.

## Scope

- Add `splunkready_check_hosted_model_access` to the SplunkReady MCP server.
- Reuse the existing hosted-model diagnostic workflow rather than creating a
  new live credential path.
- Default the MCP proof call to fixture mode so public evidence remains
  credential-free.
- Allow live mode for operator-owned shells where Splunk MCP and SAIA
  environment variables are already exported.
- Return `PASS` / `BLOCKED`, permission status, required SAIA tools, available
  tools, missing tools, artifacts, and `mutation=false`.
- Extend `mcp-proof` so the recorded stdio MCP session calls the hosted-model
  access tool and surfaces the result in the workbench.
- Refresh tracked MCP evidence, screenshot, claim ledger, and evidence hashes.

## Verification

- `npx tsc --noEmit`
- `npx vitest run tests/mcp/server.test.ts`
- `npx vitest run tests/ui/app.test.ts --testNamePattern "MCP proof"`
- `npx vitest run tests/cli/flow.test.ts --testNamePattern "MCP server proof"`
- `npm run build`
- `node dist/src/cli.js mcp-proof --out submission-evidence/mcp-proof --json`
- `node dist/src/cli.js verify-manifest --out submission-evidence/mcp-proof/mcp-transcript-certification --json`
- `node dist/src/cli.js verify-manifest --out submission-evidence/mcp-proof/mcp-inline-transcript-certification --json`
- Playwright open/snapshot/screenshot for
  `?artifacts=artifacts%2Fmcp-proof#mcp-proof`
- `npm run audit:public-demo-export`
- `npm run audit:submission-copy`
- `shasum -a 256 -c submission-evidence/evidence-pack-sha256.txt`
- `git diff --check`
- `npm run check`

## Boundaries

- Do not make SAIA or any LLM authoritative for pass/fail readiness.
- Do not mutate Splunk.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.
- Do not add a dependency.
- Do not use subagents.
