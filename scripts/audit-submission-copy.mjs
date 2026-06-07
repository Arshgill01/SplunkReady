import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.argv[2] ?? ".";
const hostedMcpProofUrl = "https://arshgill01.github.io/SplunkReady/?artifacts=artifacts%2Fmcp-proof#mcp-proof";
const hostedJudgeProofUrl =
  "https://arshgill01.github.io/SplunkReady/?artifacts=artifacts%2Fjudge-proof#proof-browser";

const files = {
  readme: readFileSync(join(rootDir, "README.md"), "utf8"),
  devpost: readFileSync(join(rootDir, "docs/devpost-submission.md"), "utf8"),
  demo: readFileSync(join(rootDir, "docs/demo-script.md"), "utf8"),
  liveAdapter: readFileSync(join(rootDir, "docs/live-adapter.md"), "utf8"),
  claimLedger: readFileSync(join(rootDir, "submission-evidence/claim-ledger.md"), "utf8")
};

const checks = [
  ["README product name", files.readme, "SplunkReady"],
  ["README tagline", files.readme, "Certify AI agents before they touch production Splunk."],
  ["README engine", files.readme, "Agent Readiness Compiler"],
  ["README primary artifact", files.readme, "Readiness Receipt"],
  ["README fixture no credentials", files.readme, "Fixture mode is the default path. It requires no Splunk credentials"],
  ["README no auto mutation", files.readme, "SplunkReady never auto-mutates Splunk"],
  ["README deterministic pass/fail", files.readme, "deterministic grader rules decide pass/fail"],
  ["README not chatbot", files.readme, "Not a Splunk chatbot."],
  ["README not copilot", files.readme, "Not a SOC copilot."],
  ["README not telemetry", files.readme, "Not MCP telemetry."],
  ["README not detection dashboard", files.readme, "Not a detection-health dashboard."],
  ["README not generic eval", files.readme, "Not a generic eval harness."],
  ["README not LLM judge", files.readme, "Not an LLM judging another LLM."],
  ["Devpost product name", files.devpost, "SplunkReady"],
  ["Devpost tagline", files.devpost, "Certify AI agents before they touch production Splunk."],
  ["Devpost track", files.devpost, "Platform & Developer Experience"],
  ["Devpost engine", files.devpost, "Agent Readiness Compiler"],
  ["Devpost primary artifact", files.devpost, "Readiness Receipt"],
  ["Devpost flagship story", files.devpost, "security investigation readiness"],
  ["Devpost no credentials", files.devpost, "requires no live Splunk credentials"],
  ["Devpost no mutation", files.devpost, "does not mutate Splunk"],
  ["README npm package link", files.readme, "https://www.npmjs.com/package/splunkready"],
  ["README clean npx judge proof", files.readme, "npx -y splunkready@0.1.0 judge-proof --out ./judge-proof --json"],
  ["Devpost clean npx judge proof", files.devpost, "npx -y splunkready@0.1.0 judge-proof --out ./judge-proof --json"],
  ["Claim ledger published npm package", files.claimLedger, "The package is published on npm and judge-runnable from a clean folder."],
  ["Claim ledger npm package page", files.claimLedger, "https://www.npmjs.com/package/splunkready"],
  ["Claim ledger published package smoke", files.claimLedger, "npx -y splunkready@0.1.0 judge-proof --out ./judge-proof --json"],
  ["README hosted MCP proof URL", files.readme, hostedMcpProofUrl],
  ["README hosted judge proof URL", files.readme, hostedJudgeProofUrl],
  ["Devpost hosted MCP proof URL", files.devpost, hostedMcpProofUrl],
  ["Devpost hosted judge proof URL", files.devpost, hostedJudgeProofUrl],
  ["Claim ledger hosted judge proof URL", files.claimLedger, hostedJudgeProofUrl],
  [
    "Claim ledger raw MCP client session",
    files.claimLedger,
    "The MCP proof includes the raw JSON-RPC client session behind the SplunkReady MCP proof."
  ],
  ["Claim ledger MCP client session JSONL", files.claimLedger, "submission-evidence/mcp-proof/mcp-client-session.jsonl"],
  ["Claim ledger MCP resource template", files.claimLedger, "splunkready://receipts/{receiptId}"],
  ["Claim ledger MCP template session", files.claimLedger, "resources/templates/list"],
  ["Claim ledger inline MCP transcript tool", files.claimLedger, "splunkready_certify_mcp_transcript_content"],
  ["Claim ledger hosted model MCP tool", files.claimLedger, "splunkready_check_hosted_model_access"],
  ["README inline MCP transcript tool", files.readme, "splunkready_certify_mcp_transcript_content"],
  ["README hosted model MCP tool", files.readme, "splunkready_check_hosted_model_access"],
  ["Demo no LLM vibes", files.demo, "not another LLM judging vibes"],
  ["Demo no mutation", files.demo, "does not mutate Splunk"],
  ["Demo route", files.demo, "splunkready-shell.html#rerun-receipts"],
  ["Live disabled", files.liveAdapter, "Live mode is disabled by default"],
  ["Live no credentials for fixture", files.liveAdapter, "Normal fixture tests must not require Splunk credentials"],
  ["Live fixed allowlist", files.liveAdapter, "fixed inventory-only allowlist"],
  ["Live no mutation", files.liveAdapter, "never writes or mutates Splunk configuration"]
];

const forbiddenPositiveClaims = [
  ["Splunk chatbot positive claim", /\bis\s+(?:a|an)\s+Splunk chatbot\b/i],
  ["SOC copilot positive claim", /\bis\s+(?:a|an)\s+SOC copilot\b/i],
  ["MCP telemetry dashboard positive claim", /\bis\s+(?:a|an)\s+MCP telemetry dashboard\b/i],
  ["telemetry dashboard positive claim", /\bis\s+(?:a|an)\s+telemetry dashboard\b/i],
  ["detection-health dashboard positive claim", /\bis\s+(?:a|an)\s+detection-health dashboard\b/i],
  ["generic eval harness positive claim", /\bis\s+(?:a|an)\s+generic eval harness\b/i],
  ["LLM judge positive claim", /\bis\s+(?:a|an)\s+LLM judge\b/i]
];

const failures = checks.filter(([, text, expected]) => !text.includes(expected));
const driftClaims = [];

for (const [fileName, text] of Object.entries(files)) {
  for (const [name, pattern] of forbiddenPositiveClaims) {
    if (pattern.test(text)) {
      driftClaims.push({ file: fileName, name, pattern: String(pattern) });
    }
  }
}

if (failures.length > 0 || driftClaims.length > 0) {
  console.error(
    JSON.stringify(
      {
        failures: failures.map(([name, , expected]) => ({ name, expected })),
        driftClaims
      },
      null,
      2
    )
  );
  process.exit(1);
}

console.log(`PASS submission copy audited (${checks.length} required claims)`);
