# Move 125 - Hosted-Model Remediation Packet

Status: implemented

## Goal

Turn live SAIA hosted-model blockers into a machine-readable operator packet
that helps unblock the Splunk AI Assistant / hosted-model track without
printing secrets, mutating Splunk, or making SAIA authoritative.

## Scope

- Add `remediation` to `hosted-model-diagnostic.json`.
- Include blocker class, safe export flag, tool evidence, operator checks, and
  rerun command.
- Expose the packet through `splunkready_check_hosted_model_access`.
- Surface the packet in the hosted-model diagnostic and MCP proof workbench
  views.
- Document the route-not-found remediation path in the live setup checklist.

## Boundaries

- SAIA output remains advisory only.
- Deterministic SplunkReady rules remain the pass/fail authority.
- SplunkReady does not auto-mutate Splunk.
- The packet does not include live endpoint URLs, tokens, or user-identifying
  values.

## Verification

- `npx tsc --noEmit && npx vitest run tests/workflows/hosted-model-actions.test.ts tests/cli/flow.test.ts tests/mcp/server.test.ts tests/ui/app.test.ts --testNamePattern "hosted-model|SAIA|MCP proof|live proof summaries"`
- `npm run mcp-proof`
- `node dist/src/cli.js mcp-proof --out submission-evidence/mcp-proof --json`
- `npm run public-demo:build`
- Playwright verification of the public MCP proof route.
- `npm run check`
