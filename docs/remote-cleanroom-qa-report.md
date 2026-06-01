# Remote Cleanroom QA Report

## Scope

Wave 46 verifies the pushed `origin/splunkready-build` branch from a clean temp checkout rather than relying on local working-tree state.

## Remote Checkout

Command shape:

```bash
remote=$(git remote get-url origin)
tmp=$(mktemp -d /tmp/splunkready-wave46-remote-XXXXXX)
git clone --depth 1 --branch splunkready-build --single-branch "$remote" "$tmp/repo"
cd "$tmp/repo"
git rev-parse --short HEAD
node --version
npm ci --ignore-scripts
npm run check
npm run build
out_dir=$(mktemp -d "$tmp/demo-XXXXXX")
env -u SPLUNKREADY_LIVE_ENABLED -u SPLUNKREADY_SPLUNK_MCP_URL -u SPLUNKREADY_SPLUNK_MCP_TOKEN npm run splunkready -- demo --out "$out_dir"
```

Result: PASS.

- Remote cleanroom path: `/tmp/splunkready-wave46-remote-9tjSfG/repo`.
- Remote commit tested: `28f72ec`.
- Node version: `v22.21.0`.
- `npm ci --ignore-scripts` installed 55 packages and found 0 vulnerabilities.
- `npm run check` passed: scaffold verifier plus 31 test files / 139 tests.
- `npm run build` passed.

## Demo Artifact Audit

Generated demo path: `/tmp/splunkready-wave46-remote-9tjSfG/demo-46doGe`.

Result:

```json
{
  "artifactCount": 18,
  "status": "PASS",
  "fitsUnderThreeMinutes": true,
  "before": "NOT READY",
  "after": "READY",
  "missing": []
}
```

Required UI strings and deterministic rule IDs were present:

- `Readiness Receipt`
- `fixture mode / after run`
- `Fail`, `Patch`, `Rerun`, `Pass`
- `SPL-001`, `SPL-003`, `KO-001`, `EVD-001`, `ANS-001`

No live Splunk credentials were provided or required.

## Reviewer Audit

Latest reviewer verdict audit passed across 47 waves:

- 47 waves with reviewer inbox files.
- 4 latest pass-with-concerns files.
- 0 failing latest verdicts.

Wave 46 introduced only documentation/report/log changes in the main working tree; generated cleanroom artifacts remain under `/tmp` and are not committed.

Late reviewer files:

- `logs/reviewer-inbox/unknown-wave-20260601-1637-review.md` reported `HIGH-001` because no Wave 46 continuation wave existed yet.
- `logs/reviewer-inbox/wave-46-20260601-1638-review.md` passed the Wave 46 scope audit and confirmed the unknown-wave `HIGH-001` was resolved by adding the Wave 46 contract and indexes.
