export const defaultFixturePath = "fixtures/acme-soc-dev/adapter-fixture.json";
export const defaultMissionPath = "fixtures/acme-soc-dev/missions/security-investigation-readiness.json";
export const defaultSuitePath = "fixtures/acme-soc-dev/suites/phase-live-readiness-suite.json";
export const defaultOutDir = "artifacts/fixture-demo";

export interface CliOptions {
  mode: "fixture" | "live";
  fixture: string;
  mission: string;
  suite: string;
  out: string;
  proofDir: string;
  securityCheckDir: string;
  securityKitDir: string;
  hostedModelProofDir: string;
  envFile: string;
  phase: "before" | "after";
  requireLive: boolean;
  requirePass: boolean;
  requireFailToPass: boolean;
  trace: string;
  transcript: string;
  agentName: string;
  agentVersion: string;
  agentModel: string;
  candidateLimit: number;
  proofDirs: string;
  strictImport: boolean;
  includeLlmProof: boolean;
  firewall: boolean;
  json: boolean;
}

export interface CliOutput {
  command: string;
  status: "PASS" | "SKIP" | "FAIL" | "BLOCKED";
  artifacts: string[];
  messages?: string[];
  error?: string;
}

export const usage = `SplunkReady CLI

Commands:
  compile   --mode fixture|live --fixture <path> --mission <path> --out <dir> [--json]
  evaluate  --mode fixture|live --out <dir> [--firewall] [--json]
  firewall-check --mode fixture|live --out <dir> [--json]
  import-mcp-transcript --transcript <path> --mission <path> --out <dir> [--strict-import true|false] [--json]
  grade-trace --trace <path> --out <dir> [--agent-name <name>] [--agent-version <version>] [--json]
  certify-mcp-transcript --transcript <path> --mission <path> --out <dir> [--strict-import true|false] [--require-pass true|false] [--agent-name <name>] [--agent-version <version>] [--json]
  llm-agent --mode fixture|live --out <dir> [--agent-model <model>]
  llm-proof --mode fixture|live --out <dir> [--agent-model <model>] [--require-pass true|false] [--json]
  hosted-model-proof --mode fixture|live --out <dir> [--env-file <path>] [--json]
  hosted-model-diagnostic --mode fixture|live --out <dir> [--env-file <path>] [--require-pass true|false] [--json]
  proof-audit --out <dir> [--require-pass true|false] [--json]
  verify-manifest --out <dir> [--json]
  certification-index --proof-dirs <dir[,dir]> --out <dir> [--require-pass true|false] [--json]
  judge-proof --out <dir> [--include-llm-proof true|false] [--json]
  mcp       Start the SplunkReady stdio MCP server
  mock-splunk-mcp --fixture <path> Start the credential-free mock Splunk stdio MCP server
  mcp-proof --out <dir> [--transcript <path>] [--json]
  live-candidates --out <dir> [--candidate-limit <n>]
  live-security-check --out <dir> [--json]
  live-security-kit --out <dir> [--json]
  live-security-proof --out <dir> [--firewall] [--json]
  live-security-ui-bundle --out <dir> [--proof-dir <dir>] [--security-check-dir <dir>] [--security-kit-dir <dir>] [--hosted-model-proof-dir <dir>] [--json]
  live-proof --out <dir> [--candidate-limit <n>] [--firewall] [--json]
  suite-proof --mode fixture --suite <path> --out <dir> [--require-fail-to-pass true|false] [--json]
  receipt   --out <dir> [--phase before|after] [--json]
  rerun     --mode fixture|live --out <dir> [--firewall] [--json]
  live-smoke --out <dir> [--require-live true|false]
  demo      --mode fixture|live --out <dir>

Defaults:
  --mode fixture
  --fixture ${defaultFixturePath}
  --mission ${defaultMissionPath}
  --suite ${defaultSuitePath}
  --out ${defaultOutDir}
`;

export const defaultCliOptions = (overrides: Partial<CliOptions> = {}): CliOptions => ({
  mode: "fixture",
  fixture: defaultFixturePath,
  mission: defaultMissionPath,
  suite: defaultSuitePath,
  out: defaultOutDir,
  proofDir: "artifacts/live-proof",
  securityCheckDir: "artifacts/live-security-check",
  securityKitDir: "artifacts/live-security-kit",
  hostedModelProofDir: "artifacts/hosted-model-proof",
  envFile: "",
  phase: "before",
  requireLive: false,
  requirePass: false,
  requireFailToPass: false,
  trace: "",
  transcript: "",
  agentName: "External Splunk MCP Agent",
  agentVersion: "unversioned",
  agentModel: "",
  candidateLimit: 12,
  proofDirs: "",
  strictImport: false,
  includeLlmProof: false,
  firewall: false,
  json: false,
  ...overrides
});

export const parseArgs = (argv: string[]): { command: string; options: CliOptions } => {
  const [command = "help", ...rest] = argv;
  const options: CliOptions = defaultCliOptions();

  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    const value = rest[index + 1];

    if (flag === "--json") {
      options.json = true;
      continue;
    }

    if (flag === "--firewall") {
      options.firewall = true;
      continue;
    }

    if (!flag.startsWith("--") || !value) {
      throw new Error(`Invalid argument near ${flag}. Use --flag value syntax.\n${usage}`);
    }

    index += 1;

    if (flag === "--mode") {
      if (value !== "fixture" && value !== "live") {
        throw new Error("--mode must be fixture or live.");
      }

      options.mode = value;
    } else if (flag === "--fixture") {
      options.fixture = value;
    } else if (flag === "--mission") {
      options.mission = value;
    } else if (flag === "--suite") {
      options.suite = value;
    } else if (flag === "--out") {
      options.out = value;
    } else if (flag === "--proof-dir") {
      options.proofDir = value;
    } else if (flag === "--security-check-dir") {
      options.securityCheckDir = value;
    } else if (flag === "--security-kit-dir") {
      options.securityKitDir = value;
    } else if (flag === "--hosted-model-proof-dir") {
      options.hostedModelProofDir = value;
    } else if (flag === "--env-file") {
      options.envFile = value;
    } else if (flag === "--proof-dirs") {
      options.proofDirs = value;
    } else if (flag === "--phase") {
      if (value !== "before" && value !== "after") {
        throw new Error("--phase must be before or after.");
      }

      options.phase = value;
    } else if (flag === "--require-live") {
      if (value !== "true" && value !== "false") {
        throw new Error("--require-live must be true or false.");
      }

      options.requireLive = value === "true";
    } else if (flag === "--require-pass") {
      if (value !== "true" && value !== "false") {
        throw new Error("--require-pass must be true or false.");
      }

      options.requirePass = value === "true";
    } else if (flag === "--require-fail-to-pass") {
      if (value !== "true" && value !== "false") {
        throw new Error("--require-fail-to-pass must be true or false.");
      }

      options.requireFailToPass = value === "true";
    } else if (flag === "--strict-import") {
      if (value !== "true" && value !== "false") {
        throw new Error("--strict-import must be true or false.");
      }

      options.strictImport = value === "true";
    } else if (flag === "--include-llm-proof") {
      if (value !== "true" && value !== "false") {
        throw new Error("--include-llm-proof must be true or false.");
      }

      options.includeLlmProof = value === "true";
    } else if (flag === "--trace") {
      options.trace = value;
    } else if (flag === "--transcript") {
      options.transcript = value;
    } else if (flag === "--agent-name") {
      options.agentName = value;
    } else if (flag === "--agent-version") {
      options.agentVersion = value;
    } else if (flag === "--agent-model") {
      options.agentModel = value;
    } else if (flag === "--candidate-limit") {
      const parsedLimit = Number(value);
      if (!Number.isInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > 25) {
        throw new Error("--candidate-limit must be an integer from 1 to 25.");
      }

      options.candidateLimit = parsedLimit;
    } else {
      throw new Error(`Unknown option ${flag}.\n${usage}`);
    }
  }

  return { command, options };
};
