# Move 12 - Final Clean-Room Submission Gate

## Goal

Prove that a judge can understand, run, and verify the frozen submission without
access to the author's local artifacts, credentials, or prior context.

## Freeze Rules

- Freeze feature work before this move.
- Use one source commit for README, video, evidence, and Devpost claims.
- Only fix submission blockers after freeze; rerun all affected checks and
  regenerate evidence when behavior changes.

## Clean-Room Checklist

### Official requirements

- Public repository URL is correct and accessible.
- Open-source license is visible.
- Root `architecture_diagram.md`, `.pdf`, or `.png` exists.
- README includes setup, run instructions, dependencies, and example data.
- Devpost track is Platform & Developer Experience.
- Public video is under three minutes and accessible while signed out.
- Video demonstrates AI usage, project function, problem, and value.
- Submission-period work is described.
- Feedback form is submitted separately.

### Product truth

- One-command fixture demo completes fail-to-pass.
- Before and after receipts, traces, policy artifacts, audit, and manifest agree.
- No activated rule is silently unimplemented.
- Fixture/live parity tests pass.
- External transcript and trace workflows run as documented.
- Live security and SAIA statuses match public evidence exactly.
- Policy patch is labeled as proposed additions/exported for review; no
  auto-mutation claim exists.

### Security and public evidence

- No tracked token, key, authorization header, private endpoint, private IP,
  user path, or secret-bearing screenshot.
- Public evidence manifests verify.
- Stale or conflicting local artifacts are not linked.
- Browser workflow, if shipped, accepts no credentials or arbitrary paths.

## Execution Plan

1. Clone the public repository into a fresh directory with no local ignored
   files.
2. Follow README setup and execute every judge quickstart command verbatim.
3. Run the canonical offline verification gate twice.
4. Run the documented external-agent workflows.
5. Open the static receipt shell and Vite artifact app at desktop and mobile
   widths.
6. Verify every README/Devpost/video/evidence link from a signed-out browser.
7. Audit tracked files and screenshots for secrets and private identifiers.
8. Record exact command results, source commit, public URLs, conditional
   blockers, and any explicit waiver.
9. Do not submit while a P0 item is waived. Conditional SAIA blockage is not a
   P0 failure if copy is accurate.

## Verification

```bash
npm ci
npm run check
npm run check
npm run splunkready -- demo --out <cleanroom-demo-dir>
npm run splunkready -- proof-audit --out <cleanroom-demo-dir> --require-pass true
npm run splunkready -- verify-manifest --out <cleanroom-demo-dir>
npm run audit:reviewers
npm run audit:submission-copy
git diff --check
git status --short
```

Add the exact documented external trace and MCP transcript commands from Move
09. Run live/SAIA checks only when the required operator environment is
available.

## Acceptance Criteria

- Clean clone passes all required offline commands.
- Submission materials satisfy official rules and are internally consistent.
- Public evidence is accessible, sanitized, and verifiable.
- All P0 moves are complete.
- Open risks are explicit and do not contradict claims.

## Stop Conditions

- Stop submission for any stale claim, inaccessible public link, missing root
  diagram, secret exposure, failed canonical gate, or silent rule gap.
- Do not delete branches or perform unrelated repository cleanup in this move.
