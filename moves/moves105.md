# Move 105 - Remote Cleanroom After Hosted Copy

## Goal

Verify the current pushed branch from a fresh remote clone after the npm
package, hosted demo, hosted judge-proof evidence, and public-copy guard work.

## Scope

- Clone `origin/splunkready-build` into a fresh temp directory.
- Run the canonical gate from the clean clone.
- Verify tracked evidence checksums.
- Smoke-test the published npm package from a clean temp folder.
- Fetch the hosted MCP proof and hosted judge-proof routes.
- Record exact command results and the corrected cleanroom procedure.

## Verification

- `npm ci --ignore-scripts`
- `npm run audit:submission-copy`
- `npm run check`
- `shasum -a 256 -c submission-evidence/evidence-pack-sha256.txt`
- `npx -y splunkready@0.1.0 judge-proof --out ./judge-proof --json`
- `curl -fsSL <hosted route>`
- `git diff --check`

## Boundaries

- Do not use live Splunk credentials.
- Do not use Gemini credentials.
- Do not run `npm publish`.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.
