import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, "../..");
const scriptPath = resolve(repoRoot, "scripts/audit-submission-copy.mjs");
const hostedMcpProofUrl = "https://arshgill01.github.io/SplunkReady/?artifacts=artifacts%2Fmcp-proof#mcp-proof";
const hostedJudgeProofUrl =
  "https://arshgill01.github.io/SplunkReady/?artifacts=artifacts%2Fjudge-proof#proof-browser";

const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-submission-copy-test-"));

const writeFixture = async (path: string, value: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
};

const baseReadme = `# SplunkReady

[![npm version](https://badge.fury.io/js/splunkready.svg)](https://www.npmjs.com/package/splunkready)

Certify AI agents before they touch production Splunk.
Agent Readiness Compiler
Readiness Receipt
Fixture mode is the default path. It requires no Splunk credentials
SplunkReady never auto-mutates Splunk
deterministic grader rules decide pass/fail
submission-evidence/readiness-score-calibration/
READY \`100\`, NEEDS REVIEW \`88\`, and NOT READY \`59\`
Not a Splunk chatbot.
Not a SOC copilot.
Not MCP telemetry.
Not a detection-health dashboard.
Not a generic eval harness.
Not an LLM judging another LLM.
npx -y splunkready@0.1.4 judge-proof --out ./judge-proof --json
npm run audit:public-package-currentness
Standalone Release Artifact
submission-evidence/standalone-release/standalone-release-current-os.json
submission-evidence/standalone-release/standalone-release-matrix.json
https://github.com/Arshgill01/SplunkReady/releases/tag/v0.1.3
submission-evidence/standalone-release/standalone-release-github-release.json
real-splunk-stress-llm-layer/
llm-deliberation-before.json
llm-claim-audit-before.json
screenshots/workbench-llm-deliberation.png
?artifacts=artifacts%2Freal-splunk-stress-llm-layer#llm-deliberation
submission-evidence/hosted-demo-currentness/hosted-demo-currentness.json
submission-evidence/screenshots/hosted-demo-llm-deliberation.png
npm run splunk-app:package
splunk-app-install-proof
submission-evidence/splunk-app-install/splunk-app-install-proof.json
submission-evidence/splunk-receipt-store/splunk-receipt-store-proof.json
submission-evidence/splunkbase-readiness/splunkbase-readiness.json
submission-evidence/splunkbase-readiness/splunkbase-listing-dossier.json
docs/splunkbase-listing-dossier.md
support-contact blocker
\`appIcon.png\` 36x36
\`appIcon_2x.png\` 72x72
\`screenshot.png\` 623x350
--confirm-write true
splunkready_receipts
splunkready_receipts_lookup
does not claim an
npm run pr-gate:sample
submission-evidence/splunk-app-package/SplunkReady-0.1.3.spl
submission-evidence/splunk-app-package/splunk-app-package-manifest.json
submission-evidence/ci-pr-gate/
dual-server-session.jsonl
compositionRecorder
AppInspect MCP composition
inspect_app
splunkready_certify_mcp_transcript_content
splunkready_check_hosted_model_access
splunkready_review_mcp_composition
splunkready://workflows/hosted-model-diagnostic
splunkready_hosted_model_diagnostic
splunkready://client-config/claude-desktop
splunkready://client-config/cursor
splunkready://client-config/antigravity
splunkready://client-config/zed
~/.gemini/antigravity/mcp_config.json
~/.config/zed/settings.json
context_servers
mcp-remote
SPLUNKREADY_SPLUNK_MCP_URL
SPLUNKREADY_SPLUNK_MCP_TOKEN
SAIA_MCP_URL
SPLUNK_AI_ASSISTANT_MCP_URL
SPLUNKREADY_SAIA_REALM
SPLUNKREADY_SAIA_TENANT
splunkready mcp
verify-receipt-chain
receipt-replay
sign-receipt
keys init
policy-publish
evaluate --policy pci-dss-readiness
receipt-chain.json
receipt-replay.json
submission-evidence/receipt-public-key.pem
receipt-private-key.local.pem
${hostedMcpProofUrl}
${hostedJudgeProofUrl}
`;

const baseDevpost = `# Devpost Submission Draft

SplunkReady
[![npm version](https://badge.fury.io/js/splunkready.svg)](https://www.npmjs.com/package/splunkready)
Certify AI agents before they touch production Splunk.
Platform & Developer Experience
Agent Readiness Compiler
Readiness Receipt
security investigation readiness
requires no live Splunk credentials
does not mutate Splunk
npx -y splunkready@0.1.4 judge-proof --out ./judge-proof --json
submission-evidence/public-package-currentness/
submission-evidence/standalone-release/standalone-release-current-os.json
submission-evidence/standalone-release/standalone-release-matrix.json
https://github.com/Arshgill01/SplunkReady/releases/tag/v0.1.3
submission-evidence/standalone-release/standalone-release-github-release.json
submission-evidence/splunk-app-package/SplunkReady-0.1.3.spl
submission-evidence/splunk-app-install/splunk-app-install-proof.json
submission-evidence/splunk-receipt-store/splunk-receipt-store-proof.json
submission-evidence/splunkbase-readiness/splunkbase-readiness.json
submission-evidence/splunkbase-readiness/splunkbase-listing-dossier.json
docs/splunkbase-listing-dossier.md
no-badge
\`appIcon.png\` 36x36
\`appIcon_2x.png\` 72x72
\`screenshot.png\` 623x350
splunkready_receipts_lookup
not claimed as publicly listed on Splunkbase
submission-evidence/ci-pr-gate/
submission-evidence/mcp-proof/dual-server-session.jsonl
submission-evidence/mcp-proof/appinspect-mcp-composition.json
advisory static validation
${hostedMcpProofUrl}
${hostedJudgeProofUrl}
`;

const baseDemo = `# Demo

not another LLM judging vibes
does not mutate Splunk
splunkready-shell.html#rerun-receipts
`;

const baseLiveAdapter = `# Live

Live mode is disabled by default
Normal fixture tests must not require Splunk credentials
fixed inventory-only allowlist
never writes or mutates Splunk configuration
`;

const baseClaimLedger = `# Submission Claim Ledger

| Claim | Status | Evidence | Verification |
| --- | --- | --- | --- |
| The package is published on npm and the current published no-clone judge proof is smoke-tested. | Supported | https://www.npmjs.com/package/splunkready | npx -y splunkready@0.1.4 judge-proof --out ./judge-proof --json |
| The deterministic readiness score is severity-weighted and non-binary, not hardcoded to 0/100. | Supported | submission-evidence/readiness-score-calibration/readiness-score-calibration.json, contractVersion: "readiness-score-calibration-v1", status: "PASS", passFailAuthority: "deterministic-rule-engine", mutation: false, \`NEEDS REVIEW\`, intermediate scores \`88\` and \`59\`, provesNonBinaryScoring: true | npm run score-calibration |
| The public registry currentness proof now verifies the published judge-proof, MCP tools, live-mock proof, policy-registry path, source \`gitHead\`, and \`mcp-recorder\` gateway before any package is called current. | Supported | submission-evidence/public-package-currentness/public-package-currentness.json, publishedLiveMockProof, publishedPolicyRegistry, publishedRecorder, registry.gitHeadMatchesPackageInputs, registry.gitHeadMatchesPackageInputs: true | status: "CURRENT"; npm run audit:public-package-currentness -- --require-current |
| The current source can produce a current-OS no-Node standalone release archive that runs judge proof from a clean temp folder. | Supported | submission-evidence/standalone-release/standalone-release-current-os.json, target \`macos-arm64\`, smoke \`status: "PASS"\`, 67 generated artifacts, releaseClaimBoundary.allPlatformReleaseRequiresTagWorkflow: true | npm run build:standalone-release -- --evidence-out submission-evidence/standalone-release/standalone-release-current-os.json |
| The release-artifacts workflow builds, smokes, and uploads standalone archives on Linux, macOS, and Windows runners. | Supported | submission-evidence/standalone-release/standalone-release-matrix.json, run \`27128293723\`, splunkready-standalone-Linux-X64, splunkready-standalone-macOS-ARM64, splunkready-standalone-Windows-X64 | gh workflow run release-artifacts.yml --ref splunkready-build; gh run watch 27128293723 --exit-status |
| The public \`v0.1.3\` GitHub Release publishes no-Node standalone assets for Linux, macOS, and Windows with checksums and per-platform manifests. | Supported | submission-evidence/standalone-release/standalone-release-github-release.json, https://github.com/Arshgill01/SplunkReady/releases/tag/v0.1.3, 27129153682, splunkready-linux-x64.tar.gz, splunkready-macos-arm64.tar.gz, splunkready-windows-x64.tar.gz, standalone-release-windows-x64.json | gh run watch 27129153682 --exit-status |
| A fresh disposable Splunk Enterprise deployment can run the flagship security proof under stress data. | Supported | submission-evidence/real-splunk-stress/real-splunk-stress-summary.json, Splunk Enterprise \`10.4.0\`, SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain, search::ES - Lateral Movement Auth Chain, prompt-trap-001, before \`NOT READY\` score \`60\`, after \`READY\` score \`100\`, 76 redacted MCP bridge frames, submission-evidence/real-splunk-stress/splunk-web-evidence-results.png | live-security-proof |
| The real Splunk stress proof is replayable through a guarded operator command. | Supported | submission-evidence/real-splunk-stress-replay/automation-manifest.json, source: "splunkready-real-splunk-stress-replay", SPLUNKREADY_ALLOW_REAL_SPLUNK_SETUP=1, submission-evidence/real-splunk-stress-replay/real-splunk-stress-replay-summary.json, READY_FOR_FLAGSHIP_LIVE_SECURITY_PROOF, mcpBridgeFrames: 76 | run-real-splunk-stress-proof |
| The LLM-backed real Splunk stress proof now records structured deliberation, advisory output-quality evidence, and deterministic claim-provenance audits. | Supported | submission-evidence/real-splunk-stress-llm-layer/real-splunk-stress-replay-summary.json, llmOutputQuality.advisoryOnly: true, before advisory score \`92\`, after advisory score \`97.5\`, before receipt \`NOT READY\` score \`0\`, after receipt \`READY\` score \`100\`, claim-evidence matrix checks, submission-evidence/real-splunk-stress-llm-layer/llm-deliberation-before.json, submission-evidence/real-splunk-stress-llm-layer/llm-deliberation-after.json, submission-evidence/real-splunk-stress-llm-layer/llm-claim-audit-before.json, submission-evidence/real-splunk-stress-llm-layer/llm-claim-audit-after.json, contractVersion: "llm-claim-audit-v1", status: "PASS", no hallucinated refs, submission-evidence/real-splunk-stress-llm-layer/ui-artifacts.json, submission-evidence/screenshots/workbench-llm-deliberation.png | run-real-splunk-stress-proof |
| The hosted public demo is source-current against the latest public-demo input commit. | Supported | submission-evidence/hosted-demo-currentness/hosted-demo-currentness.json, hosted source commit \`06c0146\`, \`artifactBases\` includes \`artifacts/real-splunk-stress-llm-layer\`, submission-evidence/screenshots/hosted-demo-llm-deliberation.png | gh workflow run public-demo-pages.yml --ref splunkready-build; gh run watch 27138145639 --exit-status; npm run audit:hosted-demo-currentness; https://arshgill01.github.io/SplunkReady/?artifacts=artifacts%2Freal-splunk-stress-llm-layer#llm-deliberation |
| The tracked suite proof has deterministic signed receipt-chain lineage and replay. | Supported | submission-evidence/suite-proof/receipt-chain.json, splunkready-receipt-chain, submission-evidence/suite-proof/receipt-replay.json, splunkready-receipt-replay, submission-evidence/receipt-public-key.pem, signature.status: "VERIFIED", signature.algorithm: "ed25519", replayedReceiptCount: 6 | verify-receipt-chain --dir submission-evidence/suite-proof --public-key submission-evidence/receipt-public-key.pem --json; receipt-replay --dir submission-evidence/suite-proof --json |
| The hosted public demo exposes the credential-free judge proof and LLM evidence boundary. | Supported | submission-evidence/screenshots/public-judge-proof-proof-browser.png | ${hostedJudgeProofUrl} |
| The public demo export exposes the real-Splunk LLM deliberation artifact route without live credentials. | Supported | artifacts/public-demo/artifacts/real-splunk-stress-llm-layer, ?artifacts=artifacts%2Freal-splunk-stress-llm-layer#llm-deliberation, screenshots/public-demo-llm-deliberation.png | npm run audit:public-demo-export |
| The hosted public demo accepts a trace and runs real in-browser certification without Splunk credentials. | Supported | submission-evidence/screenshots/interactive-demo.png, artifacts/public-demo/artifacts/interactive-demo/artifact-manifest.json, ui/src/interactiveCertifier.ts, ?demo=interactive, receipt-interactive-001 | Playwright hosted static route |
| SplunkReady ships signed, named policy bundles for default, SOC2, and PCI DSS readiness. | Supported | policies/default.policy.json, policies/soc2-readiness.policy.json, policies/pci-dss-readiness.policy.json, submission-evidence/policy-registry/default-readiness/policy-manifest.json, submission-evidence/policy-registry/soc2-readiness/policy-manifest.json, submission-evidence/policy-registry/pci-dss-readiness/policy-manifest.json, docs/policy-authoring.md, policy.id: "pci-dss-readiness" | policy-publish --policy policies/soc2-readiness.policy.json --json; evaluate --policy pci-dss-readiness |
| SplunkReady ships a credential-free Splunk app package proof for the public artifact workbench. | Supported | submission-evidence/splunk-app-package/SplunkReady-0.1.3.spl, submission-evidence/splunk-app-package/splunk-app-package-manifest.json, splunkready-splunk-app-package, SplunkReady/appserver/static/splunkready/index.html, SplunkReady/default/data/ui/views/splunkready_overview.xml, receiptCollection: "splunkready_receipts", receiptLookup: "splunkready_receipts_lookup", splunkbaseListingAssets, SplunkReady/static/appIcon.png, SplunkReady/static/appIcon_2x.png, SplunkReady/static/screenshot.png, operatorOwnedReceiptStore: true, noCredentialFiles: true, noPythonHandlers: true, noScriptedInputs: true | npm run splunk-app:package; tar -tzf submission-evidence/splunk-app-package/SplunkReady-0.1.3.spl |
| The Splunk app package has been installed and probed on the operator-owned live Splunk server. | Supported | submission-evidence/splunk-app-install/splunk-app-install-proof.json, splunkready-operator-live-splunk-app-install-proof, status: "PASS", splunkMutation: "operator-approved-app-install", operatorApproved: true, install.status: "PASS", app-metadata, launcher-view, overview-view, default-nav, receipt-collection, receipt-lookup, secretValuesWritten: false, endpointValueWritten: false, usernameValueWritten: false | splunk-app-install-proof --env-file ./.splunkready-live.env --confirm-install true |
| The installed Splunk app stores signed Readiness Receipt summaries in operator-owned KV Store rows. | Supported | submission-evidence/splunk-receipt-store/splunk-receipt-store-proof.json, splunkready-operator-receipt-kv-ingestion-proof, status: "PASS", splunkMutation: "operator-approved-receipt-store-write", operatorApproved: true, receiptSource.chainValid: true, write.requestedRows: 6, write.writtenRows: 6, lookup.status: "PASS", lookup.missingHashes: [], rawTraceValuesWritten: false | splunk-receipt-store-proof --env-file ./.splunkready-live.env --confirm-write true |
| The current \`.spl\` package is Splunkbase/Splunk Cloud submission-ready at the local evidence layer, with external listing blockers called out explicitly. | Conditional | submission-evidence/splunkbase-readiness/splunkbase-readiness.json, splunkready-splunkbase-readiness, status: "ACTION_REQUIRED", AppInspect \`error: 0\`, \`failure: 0\`, expected warning \`check_collections_conf\`, \`package-archive\`, \`live-install-proof\`, \`receipt-kv-proof\`, \`app-icon\`, \`splunkbase-screenshot\`, SplunkReady/static/appIcon.png=36x36, SplunkReady/static/appIcon_2x.png=72x72, SplunkReady/static/screenshot.png=623x350, \`publisher-account: BLOCKED_EXTERNAL\`, \`splunkbase-upload: BLOCKED_EXTERNAL\`, \`splunk-cloud-review: BLOCKED_EXTERNAL\` | npm run audit:splunkbase-readiness; do not claim Available on Splunkbase until public listing exists |
| Splunkbase portal submission now has a copy-paste listing dossier tied to package evidence and external-review guardrails. | Conditional | submission-evidence/splunkbase-readiness/splunkbase-listing-dossier.json, splunkready-splunkbase-listing-dossier, status: "READY_FOR_OPERATOR_SUBMISSION", support \`status: "OPERATOR_REQUIRED"\`, prohibit claiming Available on Splunkbase or Splunk Cloud approval before external review | npm run audit:splunkbase-listing-dossier |
| The MCP proof includes the raw JSON-RPC client session behind the SplunkReady MCP proof. | Supported | submission-evidence/mcp-proof/mcp-client-session.jsonl, resources/templates/list, splunkready://receipts/{receiptId}, splunkready_certify_mcp_transcript_content, splunkready_check_hosted_model_access, splunkready_review_mcp_composition, splunkready://workflows/hosted-model-diagnostic, splunkready_hosted_model_diagnostic, splunkready://client-config/claude-desktop, splunkready://client-config/cursor, splunkready://client-config/antigravity, splunkready://client-config/zed, ~/.gemini/antigravity/mcp_config.json, context_servers, splunkready mcp | npm run mcp-proof |
| The MCP proof exposes deterministic composition review as a first-class MCP tool. | Supported | mcpCompositionReview, splunkready_review_mcp_composition, composition-review-tool, splunk_get_knowledge_objects, splunk_run_saved_search, evt-102, evt-118, evt-141, deterministicAuthority, mutation: false | npm run mcp-proof |
| The self-hostable mock Splunk MCP path produces a credential-free live-mode proof without Splunk credentials. | Supported | submission-evidence/live-mock/live-proof-summary.json, proofLoop: "fail-to-pass", derivedMission.strategy: "saved-search-with-evidence" | npm run live-mock-proof |
| Pull requests can get a credential-free live readiness comment backed by Readiness Receipt artifacts. | Supported | .github/workflows/live-certification-gate.yml, submission-evidence/ci-pr-gate/ci-pr-gate.json, submission-evidence/ci-pr-gate/pr-comment.md, splunkready-live-readiness-pr-gate | npm run pr-gate:sample; tests/scripts/pr-gate-comment.test.ts |
| The MCP proof can run a credential-free live mock Splunk MCP session as part of the composition evidence. | Supported | liveMockSplunkMcp, submission-evidence/mcp-proof/mock-splunk-mcp-session.jsonl | mcp-proof --out submission-evidence/mcp-proof --live-mock --json |
| The MCP proof records a redacted pass-through dual-server composition session without requiring a closed desktop client. | Supported | splunkready-mcp-composition-recorder, submission-evidence/mcp-proof/dual-server-session.jsonl, submission-evidence/mcp-proof/mcp-composition-recorder-certification/mcp-transcript-import.json, redaction.status: "PASS", skippedRecords: 0, mcp-recorder --server splunk=mock-splunk-mcp --server splunkready=mcp | tests/cli/flow.test.ts -t "MCP recorder gateway"; tests/mcp/composition-recorder.test.ts |
| The MCP proof composes Splunk investigation, Splunk AppInspect validation, and SplunkReady deterministic certification without making AppInspect the receipt judge. | Supported | splunkready-appinspect-mcp-composition, submission-evidence/mcp-proof/appinspect-mcp-composition.json, inspect_app, appInspectAuthority: "advisory-static-validation", deterministicReceiptAuthority: "splunkready", failureCount: 0, warningCount: 1 | tests/workflows/appinspect-composition.test.ts |
| The MCP proof distinguishes credential-free fixture hosted-model PASS from the current operator-live SAIA blocker. | Supported | operatorLiveHostedModelStatus, SAIA_REST_HANDLERS_PARTIALLY_REGISTERED, restHandlerProbeStatus | npm run mcp-proof |
| The tracked live hosted-model status is public-safe while raw operator artifacts stay ignored. | Supported | submission-evidence/live-hosted-model-status/live-hosted-model-status.json, redactionAudit.status: "PASS", rawArtifactTracked: false | npm run audit:live-hosted-model-status |
| The MCP client config resources expose dedicated SAIA cloud routing placeholders without committing credentials. | Supported | SPLUNKREADY_SAIA_ENDPOINT, SPLUNKREADY_SAIA_TOKEN, SAIA_MCP_URL, SPLUNK_AI_ASSISTANT_MCP_URL, SPLUNKREADY_SAIA_REALM, SPLUNKREADY_SAIA_TENANT, hostedModelDiagnosticTool | npm run mcp-proof |
| The MCP client config resources use Splunk's \`mcp-remote\` client shape for the existing Splunk MCP Server side. | Supported | mcp-remote, SPLUNKREADY_SPLUNK_MCP_URL, Authorization: Bearer \${SPLUNKREADY_SPLUNK_MCP_TOKEN} | npm run mcp-proof |
`;

const writeSubmissionTree = async (root: string, claimLedger = baseClaimLedger): Promise<void> => {
  await writeFixture(join(root, "README.md"), baseReadme);
  await writeFixture(join(root, "docs/devpost-submission.md"), baseDevpost);
  await writeFixture(join(root, "docs/demo-script.md"), baseDemo);
  await writeFixture(join(root, "docs/live-adapter.md"), baseLiveAdapter);
  await writeFixture(join(root, "submission-evidence/claim-ledger.md"), claimLedger);
};

describe("submission copy audit", () => {
  it("passes when public npm package claims are present in README, Devpost, and claim ledger", async () => {
    const root = await tempRoot();
    await writeSubmissionTree(root);

    const result = await execFileAsync(process.execPath, [scriptPath, root]);

    expect(result.stdout).toContain("PASS submission copy audited");
  });

  it("fails when the claim ledger omits the published npm package claim", async () => {
    const root = await tempRoot();
    await writeSubmissionTree(root, "# Submission Claim Ledger\n");

    await expect(execFileAsync(process.execPath, [scriptPath, root])).rejects.toMatchObject({
      code: 1
    });
  });

  it("fails when Devpost omits the hosted public demo URL", async () => {
    const root = await tempRoot();
    await writeSubmissionTree(root);
    await writeFixture(join(root, "docs/devpost-submission.md"), baseDevpost.replace(hostedMcpProofUrl, ""));

    await expect(execFileAsync(process.execPath, [scriptPath, root])).rejects.toMatchObject({
      code: 1
    });
  });
});
