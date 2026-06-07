# Move 140 - Antigravity And Zed MCP Client Configs

## Intent

Improve the MCP category story without spending more time on a low-value
screencast by making the two-server workflow directly discoverable for
Antigravity and Zed.

## Scope

- Add `splunkready://client-config/antigravity` and
  `splunkready://client-config/zed` MCP resources.
- Use Antigravity's `mcpServers` config shape and Zed's `context_servers`
  config shape.
- Pull both resources into `mcp-proof`, the MCP client session artifact, and
  the MCP composition scorecard.
- Refresh tracked MCP evidence and claim-ledger guards.
- Keep credentials as placeholders only.

## Verification

- `npx vitest run tests/mcp/server.test.ts`
- `npx vitest run tests/scripts/submission-copy-audit.test.ts`
- `npm run build`
- `npm run mcp-proof`
- `npm run audit:submission-copy`

## Result

The MCP proof now reports 13 resources and a 24-request raw MCP client session,
including Antigravity and Zed client-config reads. The composition scorecard
still returns `PASS`, deterministic authority remains true, and mutation remains
false.
