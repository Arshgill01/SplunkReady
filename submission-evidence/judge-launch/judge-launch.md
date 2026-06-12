# SplunkReady Judge Launch

Use this as the compact first-read packet. It is intentionally narrower than
the full evidence directory.

## Fastest No-Clone Proof

```bash
npx -y splunkready@0.1.9 judge-proof --out ./judge-proof --json
```

Expected result: `PASS`, deterministic rule-engine authority, and
`mutation: false`.

## Fastest Hosted Review

- Workbench: `https://arshgill01.github.io/SplunkReady/`
- Default route: `?artifacts=artifacts%2Fmcp-proof#mcp-proof`
- Interactive fixture route: `?demo=interactive` — judges can upload a
  trace JSON in their browser and get a real signed Readiness Receipt
  back, all on the deterministic rule engine. Screenshot:
  `submission-evidence/screenshots/interactive-demo.png`.

## First Evidence To Inspect

1. `submission-evidence/real-splunk-proof-audit/real-splunk-proof-audit.md`
   Strict 9-check audit of the real Splunk Enterprise 10.4.0 stress replay.
2. `artifacts/platform-devex-proof/platform-devex-proof.json`
3. `submission-evidence/mcp-proof/mcp-category-scorecard.json`
4. `submission-evidence/suite-proof/suite-proof-summary.md`
5. `submission-evidence/claim-ledger.md`
6. `submission-evidence/readiness-score-calibration/readiness-score-calibration.md`
7. `submission-evidence/splunkbase-readiness/splunkbase-listing-dossier.json`

## Boundaries

- SplunkReady is a certification harness, not a chatbot or SOC copilot.
- Deterministic rules decide pass/fail; LLM output is advisory.
- The default judge path is credential-free and does not mutate Splunk.
- Public npm `splunkready@0.1.9` is the no-clone judge path. Current source has
  moved beyond it with the `splunkready/policy` SDK subpath, so SDK npm
  availability requires the next publish and currentness audit.
- Splunkbase/Splunk Cloud listing remains external until public approval exists.
