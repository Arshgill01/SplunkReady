# Move 152 - Published Package Advanced Currentness

## Intent

Close the public no-clone release skew after Moves 147-150. Version equality is
not enough: the public package must actually expose the newer live-mock and
policy-registry surfaces, not only `judge-proof` and MCP initialization.

## Scope

- Strengthen `audit:public-package-currentness` so it verifies:
  - clean published `judge-proof` with `mutation: false`;
  - published MCP initialization plus required certification tools through
    `tools/list`;
  - clean published `live-proof --live-mock` with `mode: live`,
    `mutation: false`, and `failToPass: true`;
  - clean published policy registry flow:
    `policy-publish`, `compile`, `evaluate --policy`, and `receipt`.
- Bump the package to `0.1.3` because published `0.1.2` lacks the live-mock
  and policy-registry command surfaces.
- Publish `splunkready@0.1.3` after release preflight passes.
- Refresh tracked public-package currentness evidence and public copy guards.

## Stop Conditions

- Do not read, print, or commit npm credentials.
- Do not claim live operator-owned Splunk evidence from the mock path.
- Do not weaken deterministic rule authority or make policy JSON executable.

## Verification

- `npx vitest run tests/scripts/public-package-currentness.test.ts`
- `npm run audit:public-package-currentness -- --require-current --out submission-evidence/public-package-currentness`
- `npm run audit:npm-release-preflight -- --require-ready`
- `npm run audit:package-readiness`
- `npm run audit:package-installability`
- `npm run audit:submission-copy`
- `npm publish --access public`
- `npm run audit:public-package-currentness -- --require-current --out submission-evidence/public-package-currentness`
- `npm run check`

## Result

Implemented. `splunkready@0.1.3` is published and the strengthened
public-package currentness audit reports `CURRENT`, including published
`judge-proof`, MCP required tools, `live-proof --live-mock`, and signed
policy-registry proof.
