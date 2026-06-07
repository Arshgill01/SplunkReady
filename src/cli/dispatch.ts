import { usage, type CliOptions, type CliOutput } from "./options.js";
import {
  certifyMcpTranscriptCommand,
  demoCommand,
  gradeTraceCommand,
  importMcpTranscriptCommand,
  llmAgentCommand
} from "./external-commands.js";
import {
  liveCandidatesCommand,
  liveProofCommand,
  liveSecurityCheckCommand,
  liveSecurityKitCommand,
  liveSecurityProofCommand,
  liveSecurityUiBundleCommand,
  liveSmokeCommand,
  splunkAppInstallProofCommand,
  splunkReceiptStoreProofCommand
} from "./live-commands.js";
import {
  certificationIndexCommand,
  hostedModelDiagnosticCommand,
  hostedModelProofCommand,
  judgeProofCommand,
  keysInitCommand,
  llmProofCommand,
  mcpProofCommand,
  policyInstallCommand,
  policyPublishCommand,
  proofAuditCommand,
  receiptReplayCommand,
  receiptChainCommand,
  signReceiptCommand,
  suiteProofCommand,
  verifyManifestCommand
} from "./proof-commands.js";
import {
  compileCommand,
  evaluateCommand,
  firewallCheckCommand,
  receiptCommand,
  rerunCommand
} from "../workflows/certification-actions.js";

export const runCliCommand = async (command: string, options: CliOptions): Promise<CliOutput | null> => {
  let artifacts: string[];

  if (command === "help" || command === "--help" || command === "-h") {
    return null;
  }

  if (command === "live-smoke") {
    const result = await liveSmokeCommand(options);
    return { command, status: result.status, artifacts: result.artifacts, messages: result.messages };
  }

  if (command === "compile") {
    artifacts = await compileCommand(options);
  } else if (command === "evaluate") {
    artifacts = await evaluateCommand(options);
  } else if (command === "firewall-check") {
    artifacts = await firewallCheckCommand(options);
  } else if (command === "import-mcp-transcript") {
    artifacts = await importMcpTranscriptCommand(options);
  } else if (command === "grade-trace") {
    artifacts = await gradeTraceCommand(options);
  } else if (command === "certify-mcp-transcript") {
    artifacts = await certifyMcpTranscriptCommand(options);
  } else if (command === "llm-agent") {
    artifacts = await llmAgentCommand(options);
  } else if (command === "llm-proof") {
    artifacts = await llmProofCommand(options);
  } else if (command === "hosted-model-proof") {
    const result = await hostedModelProofCommand(options);
    return { command, status: result.status, artifacts: result.artifacts, messages: result.messages };
  } else if (command === "hosted-model-diagnostic") {
    const result = await hostedModelDiagnosticCommand(options);
    return { command, status: result.status, artifacts: result.artifacts, messages: result.messages };
  } else if (command === "proof-audit") {
    artifacts = await proofAuditCommand(options);
  } else if (command === "verify-manifest") {
    artifacts = await verifyManifestCommand(options);
  } else if (command === "verify-receipt-chain") {
    artifacts = await receiptChainCommand(options);
  } else if (command === "receipt-replay") {
    artifacts = await receiptReplayCommand(options);
  } else if (command === "sign-receipt") {
    artifacts = await signReceiptCommand(options);
  } else if (command === "keys-init") {
    artifacts = await keysInitCommand(options);
  } else if (command === "policy-publish") {
    artifacts = await policyPublishCommand(options);
  } else if (command === "policy-install") {
    artifacts = await policyInstallCommand(options);
  } else if (command === "certification-index") {
    artifacts = await certificationIndexCommand(options);
  } else if (command === "judge-proof") {
    artifacts = await judgeProofCommand(options);
  } else if (command === "mcp-proof") {
    artifacts = await mcpProofCommand(options);
  } else if (command === "live-candidates") {
    artifacts = await liveCandidatesCommand(options);
  } else if (command === "live-security-check") {
    artifacts = await liveSecurityCheckCommand(options);
  } else if (command === "live-security-kit") {
    artifacts = await liveSecurityKitCommand(options);
  } else if (command === "live-security-proof") {
    artifacts = await liveSecurityProofCommand(options);
  } else if (command === "live-security-ui-bundle") {
    artifacts = await liveSecurityUiBundleCommand(options);
  } else if (command === "live-proof") {
    artifacts = await liveProofCommand(options);
  } else if (command === "splunk-app-install-proof") {
    const result = await splunkAppInstallProofCommand(options);
    return { command, status: result.status, artifacts: result.artifacts, messages: result.messages };
  } else if (command === "splunk-receipt-store-proof") {
    const result = await splunkReceiptStoreProofCommand(options);
    return { command, status: result.status, artifacts: result.artifacts, messages: result.messages };
  } else if (command === "suite-proof") {
    artifacts = await suiteProofCommand(options);
  } else if (command === "receipt") {
    artifacts = await receiptCommand(options);
  } else if (command === "rerun") {
    artifacts = await rerunCommand(options);
  } else if (command === "demo") {
    artifacts = await demoCommand(options);
  } else {
    throw new Error(`Unknown command ${command}.\n${usage}`);
  }

  return { command, status: "PASS", artifacts };
};
