# Remote Cleanroom After Demo Route Report

Wave: 79 - Remote Cleanroom After Demo Route

## Summary

Verdict: PASS after correcting the cleanroom command to build before invoking the compiled CLI.

Remote branch verified:

- Remote: `git@github.com:Arshgill01/SplunkReady.git`
- Branch: `splunkready-build`
- Expected commit: `a2d36b88b6a61afe5dffde61d12b81718215b4b2`
- Cleanroom actual commit: `a2d36b88b6a61afe5dffde61d12b81718215b4b2`
- Passing cleanroom path: `/tmp/splunkready-wave79-remote-NhMNln/repo`
- Passing cleanroom log: `/tmp/splunkready-wave79-remote-NhMNln/cleanroom.log`

## Initial Attempt

The first cleanroom attempt cloned the correct pushed commit and passed:

- `npm ci --ignore-scripts`
- `npm run audit:reviewers`
- `npm run check`

It then attempted `npm run splunkready -- demo` without first running `npm run build`. That failed because `dist/src/cli.js` did not exist in the fresh clone. This was a command-order issue in the cleanroom procedure, not a product-runtime failure.

## Corrected Command

```bash
remote=$(git remote get-url origin) &&
expected=$(git rev-parse origin/splunkready-build) &&
tmp=$(mktemp -d /tmp/splunkready-wave79-remote-XXXXXX) &&
{
  set -e
  echo "remote=$remote"
  echo "expected_commit=$expected"
  echo "tmp=$tmp"
  git clone --depth 1 --branch splunkready-build --single-branch "$remote" "$tmp/repo"
  cd "$tmp/repo"
  actual=$(git rev-parse HEAD)
  echo "actual_commit=$actual"
  test "$actual" = "$expected"
  npm ci --ignore-scripts
  npm run audit:reviewers
  npm run check
  npm run build
  out=$(mktemp -d "$tmp/demo-XXXXXX")
  unset SPLUNK_HOST SPLUNK_TOKEN SPLUNK_USERNAME SPLUNK_PASSWORD SPLUNK_SCHEME SPLUNK_PORT
  npm run splunkready -- demo --out "$out"
  node - <<'NODE' "$out"
const fs = require('fs');
const path = require('path');
const out = process.argv[2];
const rehearsal = JSON.parse(fs.readFileSync(path.join(out, 'demo-rehearsal.json'), 'utf8'));
const notes = fs.readFileSync(path.join(out, 'demo-rehearsal.md'), 'utf8');
const shell = fs.readFileSync(path.join(out, 'splunkready-shell.html'), 'utf8');
const summary = {
  out,
  uiRoute: rehearsal.uiRoute,
  routeIsReplay: String(rehearsal.uiRoute).endsWith('#certification-replay'),
  notesHasReplay: notes.includes('#certification-replay'),
  shellHasReplay: shell.includes('id="certification-replay"'),
  shellHasRerun: shell.includes('id="rerun-receipts"'),
  fitsUnderThreeMinutes: rehearsal.fitsUnderThreeMinutes,
  artifactCount: rehearsal.expectedArtifacts.length
};
console.log(JSON.stringify(summary, null, 2));
if (!summary.routeIsReplay || !summary.notesHasReplay || !summary.shellHasReplay || !summary.shellHasRerun) process.exit(20);
if (summary.artifactCount !== 18 || summary.fitsUnderThreeMinutes !== true) process.exit(21);
NODE
  if git ls-files | rg '(^|/)(\.antigravitycli|\.playwright-cli|artifacts)(/|$)'; then
    echo "sidecar_artifacts=present"
    exit 30
  else
    echo "sidecar_artifacts=absent"
  fi
} | tee "$tmp/cleanroom.log"
echo "cleanroom_log=$tmp/cleanroom.log"
```

## Results

- `npm ci --ignore-scripts`: PASS; npm reported one critical audit warning, and this verification wave made no dependency changes.
- Remote `npm run audit:reviewers`: PASS, 80 groups, 4 pass-with-concerns files, 0 failing latest verdicts.
- Remote `npm run check`: PASS, 31 test files / 143 tests.
- Remote `npm run build`: PASS.
- Remote fixture demo: PASS.
- Demo route inspection:
  - `routeIsReplay: true`
  - `notesHasReplay: true`
  - `shellHasReplay: true`
  - `shellHasRerun: true`
  - `fitsUnderThreeMinutes: true`
  - `artifactCount: 18`
- Tracked sidecar artifact scan: `sidecar_artifacts=absent`.

## Boundary Notes

- No live Splunk credentials were used.
- The demo remained fixture-backed.
- The route change was verified from the pushed branch, not local uncommitted state.
