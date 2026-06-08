# Move 186 - Public Package Recorder Currentness

## Status

Implemented on 2026-06-08.

## Objective

Close the false-positive public package currentness gap exposed after the Zed
external MCP-client proof. `splunkready@0.1.3` still passes the old no-clone
judge, MCP, live-mock, and policy-registry smoke checks, but it does not expose
the newer `mcp-recorder` gateway that made the Zed session real.

## Expected touched files

- `moves/moves186.md`
- `scripts/audit-public-package-currentness.mjs`
- `tests/scripts/public-package-currentness.test.ts`
- `submission-evidence/public-package-currentness/public-package-currentness.json`
- `submission-evidence/evidence-pack-sha256.txt`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Implementation

- Added a published `mcp-recorder` probe to
  `scripts/audit-public-package-currentness.mjs`.
- The probe starts `npx -y <package> mcp-recorder --server
  splunk=mock-splunk-mcp --server splunkready=mcp`, verifies the recorder MCP
  initialize response includes `capabilities`, verifies the proxied Splunk
  investigation tools and `splunkready_recorder_flush` tool are visible, calls a
  saved-search path, then requires the flush response to include displayable MCP
  text content and `structuredContent.status: "PASS"`.
- Added registry `gitHead` comparison so a published package can no longer be
  called source-current when npm latest points at an older commit.
- Updated focused public-package currentness tests with a fake published
  `mcp-recorder` path.

## Verification

- `node --check scripts/audit-public-package-currentness.mjs`
- `node --check tests/scripts/public-package-currentness.test.ts`
- `npx vitest run tests/scripts/public-package-currentness.test.ts`
- `npm run audit:public-package-currentness -- --out submission-evidence/public-package-currentness`
- `npm whoami && npm ping`
- `npm login --auth-type=web`
- `npm version 0.1.4 --no-git-tag-version`
- `npm run build`
- `npm run audit:package-readiness`
- `npm run audit:package-installability`
- `npm run audit:npm-release-preflight -- --require-ready`

## Result

- PASS: syntax checks passed.
- PASS: focused public-package currentness tests passed.
- PASS: hardened audit now detects the public package is stale instead of
  incorrectly reporting current.
- STALE: npm latest remains `splunkready@0.1.3`, published from gitHead
  `cb2d543950de6a3a06614d3c400b114c03a74b02`, while local HEAD is
  `4d2557f2c22c29b2d49247fc4901600cb0046932`.
- BLOCKED: published `splunkready@0.1.3 mcp-recorder --server ...` exits with
  `Unknown option --server`, so the Zed-recorder workflow is not public yet.
- PASS: npm web login completed as `brightybrainiac`.
- PASS: source version bumped to `0.1.4`.
- PASS: package readiness and installability audits passed for
  `splunkready-0.1.4.tgz`.
- PASS: npm release preflight reports `status: "READY"` for `0.1.4`.

## Next action

Publish `splunkready@0.1.4` from the authenticated npm session, then rerun
`npm run audit:public-package-currentness -- --require-current --out
submission-evidence/public-package-currentness` until it reports `CURRENT`.
