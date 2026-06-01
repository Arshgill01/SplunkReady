# Judge Resilience Report

## Scope

Wave 45 hardens SplunkReady for external judging, fresh checkouts, and final submission review.

## Fresh Checkout Readiness

- Node version requirement is declared in `package.json` as `>=22`.
- `.nvmrc` pins local version-manager setup to Node `22`.
- `README.md` now tells judges using `nvm` to run `nvm use 22`.
- `package-lock.json` is present, so fresh checkouts can use deterministic `npm ci` or the README's `npm install` path.

Fresh-copy verification was run from a temp copy excluding `.git`, `node_modules`, and `dist`:

```bash
tmp=$(mktemp -d /tmp/splunkready-wave45-fresh-XXXXXX)
mkdir "$tmp/repo"
rsync -a --exclude .git --exclude node_modules --exclude dist ./ "$tmp/repo/"
cd "$tmp/repo"
node --version
npm ci --ignore-scripts
npm run build
out_dir=$(mktemp -d "$tmp/demo-XXXXXX")
npm run splunkready -- demo --out "$out_dir"
```

Result: PASS on rerun after fixing a validation-snippet typo. The fresh copy used Node `v22.21.0`, installed dependencies, built the CLI, ran the fixture demo, and produced fixture receipts `NOT READY` -> `READY`.

## Judge Demo Readiness

The README and `docs/demo-script.md` demo commands were exercised in the main worktree:

- `npm install --dry-run`
- `npm run check`
- `npm run build`
- `npm run splunkready -- demo --out /tmp/splunkready-wave45-demo-hTC4pr`

Result: PASS. The demo wrote 18 artifacts, `demo-rehearsal.json` reported `PASS` and `fitsUnderThreeMinutes: true`, and the generated UI included the Readiness Receipt, fixture-mode disclosure, Fail/Patch/Rerun/Pass lifecycle, and required rule IDs `SPL-001`, `SPL-003`, `KO-001`, `EVD-001`, and `ANS-001`.

## Submission Copy Review

- Product name, tagline, engine name, primary artifact, submission track, and flagship security story are consistent across `README.md`, `docs/devpost-submission.md`, and `docs/demo-script.md`.
- The submission copy keeps the product boundary explicit: SplunkReady is not a chatbot, SOC copilot, MCP telemetry dashboard, detection-health dashboard, generic eval harness, or LLM-as-grader.
- Live mode boundaries remain explicit: live smoke is optional, disabled by default, read-only, and does not run searches or mutate Splunk.

## Reviewer State

- Late Wave 44 reviewer pass `logs/reviewer-inbox/wave-44-20260601-1629-review.md` is included in the Wave 45 checkpoint.
- Initial Wave 45 reviewer file `logs/reviewer-inbox/wave-45-20260601-1631-review.md` reported missing Wave 45 evidence before this report and log entries existed.
- `wave-45-20260601-1631-review.md` `HIGH-001` is resolved by this report plus Wave 45 execution and verification log entries.
- `wave-45-20260601-1631-review.md` `MEDIUM-001` is resolved by including the Wave 44 reviewer pass in the Wave 45 checkpoint.
- No Wave 45 rereview file appeared during the wait window, so the reviewer audit treats the initial Wave 45 failure as resolved by the current Wave 45 evidence and logs.
