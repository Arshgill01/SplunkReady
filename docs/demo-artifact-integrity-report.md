# Demo Artifact Integrity Report

## Scope

Wave 47 tightens the fixture demo artifact bundle checks so judge-facing receipt files, UI, and rehearsal metadata agree.

## Test Coverage Added

`tests/cli/flow.test.ts` now verifies that the demo command:

- writes the full 18-file artifact bundle;
- lists exactly those 18 generated artifact paths in `demo-rehearsal.json`;
- points `demo-rehearsal.json.uiRoute` at a real generated UI file;
- keeps `receipt-before-001.json` and `receipt-before-001.md` aligned on `NOT READY`;
- keeps `receipt-after-001.json` and `receipt-after-001.md` aligned on `READY`;
- includes the required deterministic rule IDs in both the before receipt Markdown and static UI;
- keeps the policy patch Markdown explicit that it does not change Splunk configuration.

## Verification Evidence

Targeted checks passed:

- `npx vitest run tests/cli/flow.test.ts`: 5 tests.
- `npx tsc --noEmit`.

Broader check passed:

- `npm run check`: scaffold verifier plus 31 test files / 139 tests.

Manual fixture demo artifact inspection also passed at `/tmp/splunkready-wave47-demo-u95OAJ`:

```json
{
  "artifactCount": 18,
  "rehearsalArtifacts": 18,
  "missingPaths": [],
  "before": "NOT READY",
  "after": "READY",
  "beforeMarkdownVerdict": true,
  "afterMarkdownVerdict": true,
  "missingRuleIds": []
}
```

No live Splunk credentials were provided or required.

## Late Reviewer Files

- `logs/reviewer-inbox/unknown-wave-20260601-1640-rereview.md` passed and confirmed the earlier unknown-wave continuation finding resolved.
- `logs/reviewer-inbox/wave-46-20260601-1640-rereview.md` passed and confirmed Wave 46 cleanroom QA.
- No Wave 47 reviewer file appeared during the wait window before the Wave 47 commit.
