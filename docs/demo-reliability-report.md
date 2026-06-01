# Demo Reliability Report

## Scope

Wave 42 validates that the judge-facing fixture demo still runs, writes complete artifacts, serves locally, and opens the primary receipt-rerun route.

## Verdict

- Status: PASS.
- Code changes required: none.
- Demo directory used: `/tmp/splunkready-wave42-demo-46n1zG`.
- Browser screenshot: `/tmp/splunkready-wave42-rerun-receipts.png`.

## Checks

| Check | Result | Evidence |
| --- | --- | --- |
| Demo command completes | PASS | `npm run splunkready -- demo --out /tmp/splunkready-wave42-demo-46n1zG` printed `PASS demo`. |
| Rehearsal under 3 minutes | PASS | `demo-rehearsal.json` reported `fitsUnderThreeMinutes: true` and `measuredSeconds: 0.03`. |
| Artifact set complete | PASS | 18 expected artifacts existed. |
| UI links required receipt data | PASS | Generated shell contained `receipt-before-001.json`, `receipt-after-001.json`, `policy-patch`, and the required rule IDs. |
| Primary route opens | PASS | Playwright opened `http://127.0.0.1:41742/splunkready-shell.html#rerun-receipts`. |
| Screenshot captured | PASS | Screenshot was captured as a 1280 x 6553 PNG. |
| Product boundary preserved | PASS | No UI or CLI code changes were needed. |

## Commands Run

```bash
command -v npx >/dev/null 2>&1 && echo NPX_OK && export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}" && export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh" && test -x "$PWCLI" && echo "PWCLI=$PWCLI"
```

Result: partial. `npx` was present, but the wrapper script is not executable. The browser checks used `bash /Users/arshdeepsingh/.codex/skills/playwright/scripts/playwright_cli.sh ...`.

```bash
npm run build && tmp=$(mktemp -d /tmp/splunkready-wave42-demo-XXXXXX) && npm run splunkready -- demo --out "$tmp" && node - <<'NODE' "$tmp"
const fs = require('fs');
const path = require('path');
const dir = process.argv[2];
const rehearsal = JSON.parse(fs.readFileSync(path.join(dir, 'demo-rehearsal.json'), 'utf8'));
const expected = rehearsal.expectedArtifacts ?? [];
const missing = expected.filter((file) => !fs.existsSync(file));
const shell = fs.readFileSync(path.join(dir, 'splunkready-shell.html'), 'utf8');
const required = ['id="rerun-receipts"', 'receipt-before-001.json', 'receipt-after-001.json', 'policy-patch', 'SPL-001', 'SPL-003', 'KO-001', 'EVD-001', 'ANS-001'];
const missingUi = required.filter((needle) => !shell.includes(needle));
const before = JSON.parse(fs.readFileSync(path.join(dir, 'receipt-before-001.json'), 'utf8'));
const after = JSON.parse(fs.readFileSync(path.join(dir, 'receipt-after-001.json'), 'utf8'));
const result = { dir, status: rehearsal.status, fitsUnderThreeMinutes: rehearsal.fitsUnderThreeMinutes, measuredSeconds: rehearsal.measuredSeconds, artifactCount: expected.length, missing, missingUi, before: before.verdict, after: after.verdict, route: rehearsal.uiRoute };
console.log(JSON.stringify(result, null, 2));
if (missing.length || missingUi.length || rehearsal.status !== 'PASS' || !rehearsal.fitsUnderThreeMinutes || before.verdict !== 'NOT READY' || after.verdict !== 'READY') process.exit(1);
NODE
```

Result: PASS. The command produced 18 artifacts, no missing UI strings, fixture `NOT READY` -> `READY`, and route `/tmp/splunkready-wave42-demo-46n1zG/splunkready-shell.html#rerun-receipts`.

```bash
python3 -m http.server 41742 --bind 127.0.0.1 --directory /tmp/splunkready-wave42-demo-46n1zG
```

Result: PASS. The generated demo directory served locally until the verification finished, then the server was stopped.

```bash
bash /Users/arshdeepsingh/.codex/skills/playwright/scripts/playwright_cli.sh open http://127.0.0.1:41742/splunkready-shell.html#rerun-receipts && bash /Users/arshdeepsingh/.codex/skills/playwright/scripts/playwright_cli.sh snapshot && mkdir -p output/playwright && bash /Users/arshdeepsingh/.codex/skills/playwright/scripts/playwright_cli.sh screenshot --filename output/playwright/wave-42-rerun-receipts.png --full-page
```

Result: PASS. Playwright reported page title `SplunkReady - Readiness Receipt`, URL `http://127.0.0.1:41742/splunkready-shell.html#rerun-receipts`, and a screenshot was captured.

```bash
file output/playwright/wave-42-rerun-receipts.png && ls -lh output/playwright/wave-42-rerun-receipts.png
```

Result: PASS. The screenshot was a 1280 x 6553 PNG, 959K.

```bash
npm run check
```

Result: PASS. Scaffold verifier and 31 test files / 139 tests passed.

## Notes

- `output/` and `.playwright-cli/` were removed after copying the screenshot to `/tmp` so generated browser artifacts do not dirty the repository.
- The route and screenshot confirm that the current generated UI exposes the before/after Readiness Receipts, score comparison, policy patch, critical issue/fix mapping, traces, provenance, violations, and loaded artifact paths.
