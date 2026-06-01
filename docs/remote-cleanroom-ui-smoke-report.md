# Remote Cleanroom UI Smoke Report

Wave: 57 - Remote Cleanroom UI Smoke

## Scope

Verify the pushed `origin/splunkready-build` branch after Wave 56 from a fresh clone outside the main worktree.

## Cleanroom

- Remote: `git@github.com:Arshgill01/SplunkReady.git`
- Branch: `splunkready-build`
- Clone path: `/tmp/splunkready-wave57-remote-amX14Y/repo`
- Commit tested: `83ebc6b`
- Demo output: `/tmp/splunkready-wave57-remote-amX14Y/demo-E3bfBO`

## Commands

```bash
git clone --depth 1 --branch splunkready-build --single-branch "$remote" "$tmp/repo"
npm ci --ignore-scripts
npm run check
npm run audit:reviewers
npm run build
env -u SPLUNKREADY_LIVE_ENABLED -u SPLUNKREADY_SPLUNK_MCP_URL -u SPLUNKREADY_SPLUNK_MCP_TOKEN npm run splunkready -- demo --out "$out_dir"
node - <<'NODE' "$tmp" "$commit" "$out_dir" ... NODE
```

## Result

PASS.

- `npm ci --ignore-scripts` installed 55 packages and reported 0 vulnerabilities.
- `npm run check` passed: scaffold verifier plus 31 test files / 139 tests.
- `npm run audit:reviewers` passed: 58 groups, 4 pass-with-concerns files, 0 failing latest verdicts.
- `npm run build` passed.
- Fixture demo passed with live Splunk environment variables unset.
- Demo produced 18 artifacts.
- Before receipt: `NOT READY`, score `0`.
- After receipt: `READY`, score `100`.
- `demo-rehearsal.json` reported `status: PASS` and `fitsUnderThreeMinutes: true`.
- Generated `splunkready-shell.html` contained the Wave 56 UI hooks:
  - `scroll-behavior: smooth;`
  - `@media (prefers-reduced-motion: reduce)`
  - `window.addEventListener("hashchange", updateActiveLink)`
  - `.side-nav a:hover`
  - `tbody tr:hover td`

## Notes

- This cleanroom verified the pushed branch, not local uncommitted files.
- No live Splunk credentials were required.
- No Splunk mutation path was exercised.
