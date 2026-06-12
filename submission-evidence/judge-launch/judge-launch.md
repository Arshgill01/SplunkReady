# SplunkReady Judge Launch

Use this as the compact first-read packet. It is intentionally narrower than
the full evidence directory.

## Fastest No-Clone Proof

```bash
npx -y splunkready@0.1.7 judge-proof --out ./judge-proof --json
```

Expected result: `PASS`, deterministic rule-engine authority, and
`mutation: false`.

## Fastest Hosted Review

- Workbench: `https://arshgill01.github.io/SplunkReady/`
- Default route: `?artifacts=artifacts%2Fmcp-proof#mcp-proof`
- Interactive fixture route: `?demo=interactive`

## First Evidence To Inspect

1. `artifacts/platform-devex-proof/platform-devex-proof.json`
2. `submission-evidence/mcp-proof/mcp-category-scorecard.json`
3. `submission-evidence/suite-proof/suite-proof-summary.md`
4. `submission-evidence/claim-ledger.md`
5. `submission-evidence/readiness-score-calibration/readiness-score-calibration.md`
6. `submission-evidence/splunkbase-readiness/splunkbase-listing-dossier.json`

## Boundaries

- SplunkReady is a certification harness, not a chatbot or SOC copilot.
- Deterministic rules decide pass/fail; LLM output is advisory.
- The default judge path is credential-free and does not mutate Splunk.
- Public npm source-currentness still requires the next publish after `0.1.7`.
- Splunkbase/Splunk Cloud listing remains external until public approval exists.
