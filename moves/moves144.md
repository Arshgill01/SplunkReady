# Move 144 - Hosted Demo Currentness After MCP Review

## Intent

Keep the public GitHub Pages demo source-current after Move 143 changed the MCP
proof route, public-demo bundle input, and generated asset names.

## Scope

- Confirm the hosted demo is stale after Move 143.
- Run the manual `Public Demo Pages` workflow from `splunkready-build`.
- Verify the hosted demo manifest and asset names match the Move 143 commit.
- Refresh the tracked hosted-demo currentness evidence.
- Update execution, verification, risk, and claim-ledger context.

## Verification

- `npm run audit:hosted-demo-currentness -- --require-current --out submission-evidence/hosted-demo-currentness/hosted-demo-currentness.json`
- `gh workflow run "Public Demo Pages" --ref splunkready-build`
- `gh run watch 27097716293 --exit-status`
- `npm run audit:hosted-demo-currentness -- --require-current --out submission-evidence/hosted-demo-currentness/hosted-demo-currentness.json`
- `npm run audit:submission-copy`
- `git diff --check`

## Result

The hosted demo is current against commit
`97d59f44a67a35366bc0551e70a57956c81f78a6`; hosted and local asset names match
(`index-BMPTXFQp.css`, `index-TSYoqcYX.js`), failures are empty, and
`mutation=false`.
