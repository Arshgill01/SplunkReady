# Move 184 - Hosted Demo Currentness After Zed MCP Evidence

## Status

Implemented on 2026-06-08.

## Objective

Refresh the hosted GitHub Pages demo currentness evidence after Move 183 added a
new tracked MCP screenshot under `submission-evidence/screenshots`, which is a
public-demo input path.

## Expected touched files

- `submission-evidence/hosted-demo-currentness/hosted-demo-currentness.json`
- `submission-evidence/evidence-pack-sha256.txt`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`
- `moves/moves184.md`

## Implementation

- Pushed Move 183 commit `b23a309` to `origin/splunkready-build`.
- Triggered GitHub Actions workflow `public-demo-pages.yml`.
- Watched Pages run `27140813335` through successful build and deploy.
- Refreshed hosted-demo currentness evidence against the live Pages manifest.
- Recomputed and verified the submission evidence SHA-256 ledger.

## Verification

- `git push origin splunkready-build`
- `gh workflow run public-demo-pages.yml --ref splunkready-build`
- `gh run watch 27140813335 --exit-status`
- `npm run audit:hosted-demo-currentness -- --out submission-evidence/hosted-demo-currentness/hosted-demo-currentness.json --require-current`
- `find submission-evidence -type f ! -name evidence-pack-sha256.txt -print | sort | xargs shasum -a 256 > submission-evidence/evidence-pack-sha256.txt && shasum -a 256 -c submission-evidence/evidence-pack-sha256.txt`

## Result

- Hosted demo currentness is `CURRENT`.
- Expected public-demo input commit is `b23a3093f34f9859f54a0568e84ac1ee2d62415e`.
- Hosted source commit is `b23a3093f34f9859f54a0568e84ac1ee2d62415e`.
- Hosted and local asset names match.
- Hosted manifest reports `mutation: false`.
