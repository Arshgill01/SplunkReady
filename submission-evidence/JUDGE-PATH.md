# SplunkReady Judge Path

Open this file first. The full `submission-evidence/` directory is intentionally
large because it preserves proof history; judges do not need to read it all.

## Fastest Proof

No clone, no credentials:

```bash
npx -y splunkready@0.1.7 judge-proof --out ./judge-proof --json
```

From a clone:

```bash
npm install
npm run platform-proof
npm run judge-proof
```

Expected result: `PASS`, deterministic rule-engine authority, and
`mutation: false`.

## Six Evidence Files To Inspect

1. `submission-evidence/suite-proof/suite-proof-summary.md`
   Credential-free fail-to-pass certification suite.

2. `submission-evidence/mcp-proof/mcp-category-scorecard.json`
   Best Use of Splunk MCP Server scorecard: Splunk MCP as investigation/data
   plane, SplunkReady as deterministic readiness gate, strong external-client
   evidence, zero mutation.

3. `submission-evidence/mcp-proof/mcp-proof-summary.md`
   Splunk MCP transcript and two-server MCP certification proof.

4. `submission-evidence/claim-ledger.md`
   Public claim-to-evidence map.

5. `submission-evidence/readiness-score-calibration/readiness-score-calibration.md`
   Deterministic READY / NEEDS REVIEW / NOT READY score calibration.

6. `submission-evidence/splunkbase-readiness/splunkbase-listing-dossier.json`
   Developer-tools evidence for the packaged Splunk app path, including the
   external blockers that are not claimed as complete.

Supporting developer workflow proof:

- `artifacts/platform-devex-proof/platform-devex-proof.json` after
  `npm run platform-proof`
- `submission-evidence/ci-pr-gate/pr-comment.md`
- `submission-evidence/ci-pr-gate/ci-pr-gate.json`
- `submission-evidence/mcp-proof/mcp-category-scorecard.md`
- `submission-evidence/mcp-proof/mcp-transcript-certification/mcp-transcript-certification.json`
- `submission-evidence/mcp-proof/mcp-transcript-certification/receipt-external-001.json`

## What This Proves

- SplunkReady is a certification harness, not a chatbot.
- The Agent Readiness Compiler grades trace structure deterministically.
- Readiness Receipts cite contract, trace, violation, and evidence data.
- Fixture and live-style paths share internal interfaces.
- SplunkReady can certify captured Splunk MCP behavior into a receipt.
- Developers can use the same proof shape from a local command, npm package,
  GitHub Action, external trace import, or MCP transcript import.
- The default judge path does not mutate Splunk and needs no credentials.

## Developer Workflow Surface

- Local proof: `npm run judge-proof`
- Platform proof wrapper: `npm run platform-proof`
- No-clone proof: `npx -y splunkready@0.1.7 judge-proof --out ./judge-proof --json`
- MCP proof: `npm run mcp-proof`
- PR gate sample: `npm run pr-gate:sample`
- Trace bridge examples: `examples/README.md`
- GitHub Action: `action.yml`

## What To Ignore Unless Auditing

- `moves/`: build history.
- `logs/reviewer-inbox/`: reviewer-loop history.
- Historical proof variants under this directory that are not listed above.
