# Move 118 - Package MCP Installability Audit

## Goal

Make the npm package gate prove the newly added MCP entrypoint is installable
and usable from a clean temp project, not only that `judge-proof` passes.

## Scope

- Extend `scripts/audit-package-installability.mjs` to spawn the installed
  `npx splunkready mcp` command from a temp project.
- Send a JSON-RPC MCP `initialize` request over stdio and require a valid
  SplunkReady server response.
- Keep the existing packed-package `judge-proof` PASS and `mutation: false`
  assertions.
- Document the release gate in README and claim-ledger evidence.

## Boundaries

- Do not call live Splunk.
- Do not read or print `.splunkready*` or `.env*` files.
- Do not make hosted-model or LLM output authoritative.
- Do not mutate Splunk.
- Do not use subagents.

## Verification

- `node scripts/audit-package-installability.mjs`
- `npm run audit:package-installability`
- `npm run check`
- `tmp=$(mktemp -d /tmp/splunkready-publish-smoke-XXXXXX); cd "$tmp"; npx -y splunkready@0.1.0 judge-proof --out ./judge-proof --json; node -e '...'`
