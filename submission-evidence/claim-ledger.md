# Submission Claim Ledger

Generated on 2026-06-05 from source commit `606e2e6`.

| Claim | Status | Evidence | Verification |
| --- | --- | --- | --- |
| SplunkReady is a pre-production certification harness, not a chatbot or SOC copilot. | Supported | `README.md`; `AGENTS.md`; `submission-evidence/suite-proof/suite-proof-summary.json` | `npm run audit:submission-copy` |
| The Agent Readiness Compiler produces Readiness Receipts with deterministic verdicts. | Supported | `submission-evidence/suite-proof/*/receipt-before-001.json`; `submission-evidence/suite-proof/*/receipt-after-001.json`; `submission-evidence/suite-proof/proof-audit.json` | `npm run splunkready -- proof-audit --out submission-evidence/suite-proof --require-pass true --json` |
| The demo shows NOT READY -> READY after policy guidance. | Supported | `submission-evidence/suite-proof/suite-proof-summary.json`; `submission-evidence/suite-proof/proof-audit.json` | `npm run splunkready -- verify-manifest --out submission-evidence/suite-proof --json` |
| The proof covers more than one mission. | Supported | `submission-evidence/suite-proof/suite-proof-summary.json` reports `missionCount: 3` | `npm run splunkready -- proof-audit --out submission-evidence/suite-proof --require-pass true --json` |
| The proof covers security and observability domains. | Supported | `submission-evidence/suite-proof/suite-proof-summary.json` reports `domains: ["observability", "security"]` | Inspect `submission-evidence/suite-proof/suite-proof-summary.json` |
| The final receipts include evidence provenance. | Supported | `submission-evidence/suite-proof/suite-proof-summary.json` reports `totals.evidenceRefs: 15`; mission `receipt-after-001.json` files list evidence refs | `npm run splunkready -- proof-audit --out submission-evidence/suite-proof --require-pass true --json` |
| The suite proof does not mutate Splunk. | Supported | `submission-evidence/suite-proof/suite-proof-summary.json` and `proof-audit.json` report `mutation: false` | `npm run splunkready -- proof-audit --out submission-evidence/suite-proof --require-pass true --json` |
| The tracked suite proof has an internally consistent manifest. | Supported | `submission-evidence/suite-proof/proof-manifest.json`; `submission-evidence/suite-proof/proof-manifest-verification.json` | `npm run splunkready -- verify-manifest --out submission-evidence/suite-proof --json` |
| The public proof export is redacted before sharing. | Supported | `submission-evidence/public-proof-export/public-proof-export-manifest.json`; `submission-evidence/public-proof-export/public-proof-summary.json`; `submission-evidence/screenshots/public-proof-export-proof-browser.png` | Secret scan plus manifest inspection |
| The local workbench can run packaged UI and API from one origin. | Supported | `submission-evidence/screenshots/workbench-packaged-fixture.png`; Move 20 verification log | `SPLUNKREADY_WORKBENCH_PORT=4337 npm run workbench` plus Playwright click flow |
| The local workbench can run Vite-backed UI and API from one origin. | Supported | `submission-evidence/screenshots/workbench-dev-fixture.png`; Move 20 verification log | `SPLUNKREADY_WORKBENCH_PORT=4338 npm run workbench:dev` plus Playwright click flow |
| Live proof exists only when operator-owned live environment variables are provided. | Conditional | `README.md`; `submission-evidence/README.md` redaction boundary | Do not cite raw ignored live artifacts from this tracked evidence pack |
