# Move 145 - Published Package With MCP Review Tool

## Intent

Publish the Move 143 MCP composition-review surface to npm so no-clone judges
can initialize the current SplunkReady MCP server and see
`splunkready_review_mcp_composition` through `tools/list`.

## Scope

- Bump the source package version to `0.1.2`.
- Verify release readiness, package installability, and canonical checks before
  publishing.
- Publish `splunkready@0.1.2` to npm.
- Verify npm latest, no-clone `judge-proof`, no-clone MCP initialization, and
  the published `tools/list` output.
- Refresh public-package currentness evidence and public copy guards.

## Verification

- `npm view splunkready version dist-tags versions --json`
- `npm run audit:npm-release-preflight`
- `npm run audit:package-readiness`
- `npm run audit:package-installability`
- `npx vitest run tests/scripts/public-package-currentness.test.ts tests/scripts/submission-copy-audit.test.ts`
- `npm run audit:submission-copy`
- `npm run check`
- `npm publish --access public`
- `tmp=$(mktemp -d /tmp/splunkready-publish-smoke-XXXXXX) && cd "$tmp" && npx -y splunkready@0.1.2 judge-proof --out ./judge-proof --json`
- `npm run audit:public-package-currentness -- --require-current --out submission-evidence/public-package-currentness`
- Published MCP `tools/list` smoke verifying `splunkready_review_mcp_composition`.

## Result

`splunkready@0.1.2` is published and npm latest points at it. The published
package returns `PASS` for no-clone `judge-proof`, initializes the MCP stdio
server, and lists 6 MCP tools including
`splunkready_review_mcp_composition`.
