# SplunkReady Judge Path

Open this file first. The full `submission-evidence/` directory is intentionally
large because it preserves proof history; judges do not need to read it all.

## Fastest Proof

Hosted, no credentials:

- `https://arshgill01.github.io/SplunkReady/?artifacts=artifacts%2Fmcp-proof#mcp-proof`
- `submission-evidence/judge-launch/judge-launch.json`
- `submission-evidence/judge-launch/judge-launch.md`

Interactive in-browser certifier (judges can run this themselves):

- `https://arshgill01.github.io/SplunkReady/?demo=interactive`
- `submission-evidence/screenshots/interactive-demo.png`
- `ui/src/interactiveCertifier.ts` (in-browser deterministic grader)

No clone, no credentials:

```bash
npx -y splunkready@0.1.11 judge-proof --out ./judge-proof --json
```

From a clone:

```bash
npm install
npm run platform-proof
npm run judge-proof
```

Expected result: `PASS`, deterministic rule-engine authority, and
`mutation: false`.

## First-Read Evidence Files

The order below is intentional. Read top to bottom for the strongest
Platform & Developer Experience and Security narrative; read the
MCP-specific items in the same order to land on the Bonus prize
story.

1. `submission-evidence/judge-launch/judge-launch.md`
   Compact launch packet: hosted route, no-clone command, first-read evidence,
   and claim boundaries.

2. `submission-evidence/real-splunk-proof-audit/real-splunk-proof-audit.md`
   Strict 9-check audit of the real Splunk Enterprise 10.4.0 stress replay.
   Fresh disposable container, operator-scoped setup, security stressors,
   deployment-derived readiness, deterministic fail-to-pass receipts
   (`NOT READY 60` -> `READY 100`), live evidence refs, MCP bridge session,
   official Splunk MCP boundary language, and advisory-only LLM behavior.
   This is the strongest product evidence in the pack and is the recommended
   first-read for the Platform & Developer Experience track.

3. `submission-evidence/suite-proof/suite-proof-summary.md`
   Credential-free fail-to-pass certification suite.

4. `submission-evidence/mcp-proof/mcp-category-scorecard.json`
   Best Use of Splunk MCP Server scorecard: Splunk MCP as investigation/data
   plane, SplunkReady as deterministic readiness gate, strong external-client
   evidence, zero mutation.

5. `submission-evidence/mcp-proof/mcp-proof-summary.md`
   Splunk MCP transcript and two-server MCP certification proof.

6. `submission-evidence/claim-ledger.md`
   Public claim-to-evidence map.

7. `submission-evidence/readiness-score-calibration/readiness-score-calibration.md`
   Deterministic READY / NEEDS REVIEW / NOT READY score calibration.

8. `submission-evidence/splunkbase-readiness/splunkbase-listing-dossier.json`
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
- No-clone proof: `npx -y splunkready@0.1.11 judge-proof --out ./judge-proof --json`
- MCP proof: `npm run mcp-proof`
- PR gate sample: `npm run pr-gate:sample`
- Trace bridge examples: `examples/README.md`
- GitHub Action: `action.yml`

## What To Ignore Unless Auditing

- `moves/`: build history.
- `logs/reviewer-inbox/`: reviewer-loop history.
- Historical proof variants under this directory that are not listed above.
