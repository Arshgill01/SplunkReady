# Move 142 - Published Package Currentness Refresh

## Intent

Close the public-package currentness cap after the user published
`splunkready@0.1.1`.

## Scope

- Verify npm latest points at `splunkready@0.1.1`.
- Smoke-test the published package from a clean temp folder.
- Refresh the tracked public-package currentness evidence.
- Update README, Devpost copy, claim ledger, and submission-copy guards to use
  the current published package path.

## Verification

- `npm view splunkready version dist-tags --json`
- `tmp=$(mktemp -d /tmp/splunkready-publish-smoke-XXXXXX) && cd "$tmp" && npx -y splunkready@0.1.1 judge-proof --out ./judge-proof --json`
- `npm run audit:public-package-currentness -- --require-current --out submission-evidence/public-package-currentness`
- `npm run audit:submission-copy`
- `npx vitest run tests/scripts/submission-copy-audit.test.ts`
- `npm run audit:public-package-currentness -- --require-current --out /tmp/splunkready-public-package-currentness-move142`

## Result

The registry reports `latest: 0.1.1`; the no-clone `judge-proof` smoke returns
`PASS`; the currentness audit reports `CURRENT`; published `judge-proof` and
published `mcp` both pass with `mutation=false`.
