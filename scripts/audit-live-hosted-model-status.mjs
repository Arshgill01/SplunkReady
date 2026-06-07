import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const args = process.argv.slice(2);

const optionValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const hasFlag = (name) => args.includes(name);

const artifactPath = optionValue("--artifact", "artifacts/live-hosted-model-diagnostic/hosted-model-diagnostic.json");
const envFilePath = optionValue("--env-file", undefined);
const outPath = optionValue("--out", undefined);
const expectBlocker = optionValue("--expect-blocker", undefined);
const requireBlocked = hasFlag("--require-blocked");

const sensitiveNamePattern = /(TOKEN|SECRET|PASSWORD|API_KEY|CREDENTIAL|MCP_URL|ENDPOINT|URL)$/i;
const bearerSecretPattern = /\bBearer\s+(?!\$\{)[A-Za-z0-9._~+/=-]{8,}/i;

const fail = (message, extra = {}) => {
  console.error(JSON.stringify({ status: "FAIL", message, ...extra }, null, 2));
  process.exit(1);
};

const parseEnvFile = (path) => {
  if (!path || !existsSync(path)) {
    return [];
  }

  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .flatMap((line) => {
      const [rawName, ...rawValueParts] = line.split("=");
      const name = rawName.trim().replace(/^export\s+/, "");
      let value = rawValueParts.join("=").trim();

      if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      return name && value ? [{ name, value }] : [];
    });
};

const processSecretValues = Object.entries(process.env)
  .filter(([name, value]) => sensitiveNamePattern.test(name) && typeof value === "string" && value.length >= 8)
  .map(([name, value]) => ({ name, value }));

const envFileSecretValues = parseEnvFile(envFilePath).filter(
  ({ name, value }) => sensitiveNamePattern.test(name) && value.length >= 8 && value !== "undefined"
);

const secretCandidates = envFilePath ? envFileSecretValues : processSecretValues;
const secretValues = secretCandidates.filter(
  ({ value }, index, all) => all.findIndex((candidate) => candidate.value === value) === index
);

const listFiles = (path) => {
  const stat = statSync(path);

  if (stat.isFile()) {
    return [path];
  }

  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const childPath = join(path, entry.name);
    return entry.isDirectory() ? listFiles(childPath) : [childPath];
  });
};

if (!existsSync(artifactPath)) {
  fail(`Live hosted-model artifact not found at ${artifactPath}.`);
}

const checkedFiles = listFiles(artifactPath);
const leaks = [];
const bearerLeaks = [];

for (const filePath of checkedFiles) {
  const text = readFileSync(filePath, "utf8");

  for (const { name, value } of secretValues) {
    if (text.includes(value)) {
      leaks.push({ file: relative(process.cwd(), filePath), variable: name });
    }
  }

  if (bearerSecretPattern.test(text)) {
    bearerLeaks.push(relative(process.cwd(), filePath));
  }
}

if (leaks.length > 0 || bearerLeaks.length > 0) {
  fail("Live hosted-model artifact contains unredacted operator values.", { leaks, bearerLeaks });
}

const diagnostic = JSON.parse(readFileSync(artifactPath, "utf8"));
const permission = diagnostic.permission && typeof diagnostic.permission === "object" ? diagnostic.permission : {};
const restHandlerProbe =
  diagnostic.restHandlerProbe && typeof diagnostic.restHandlerProbe === "object" ? diagnostic.restHandlerProbe : {};
const remediation = diagnostic.remediation && typeof diagnostic.remediation === "object" ? diagnostic.remediation : {};

if (requireBlocked && diagnostic.status !== "BLOCKED") {
  fail(`Expected a BLOCKED live hosted-model diagnostic, got ${String(diagnostic.status)}.`);
}

if (expectBlocker && diagnostic.blockerClass !== expectBlocker) {
  fail(`Expected blocker ${expectBlocker}, got ${String(diagnostic.blockerClass)}.`);
}

const report = {
  source: "splunkready-live-hosted-model-status",
  status: diagnostic.status === "PASS" ? "PASS" : "BLOCKED",
  mode: diagnostic.mode ?? "live",
  blockerClass: diagnostic.blockerClass ?? "UNKNOWN",
  permissionStatus: permission.status ?? "UNKNOWN",
  permissionBlockerClass: permission.blockerClass ?? diagnostic.blockerClass ?? "UNKNOWN",
  restHandlerProbeStatus: restHandlerProbe.status ?? "NOT_RUN",
  requiredTools: Array.isArray(diagnostic.requiredTools) ? diagnostic.requiredTools : [],
  availableTools: Array.isArray(diagnostic.availableTools) ? diagnostic.availableTools : [],
  passedTools: Array.isArray(diagnostic.passedTools) ? diagnostic.passedTools : [],
  blockedTools: Array.isArray(diagnostic.blockedTools) ? diagnostic.blockedTools : [],
  summary:
    typeof remediation.summary === "string"
      ? remediation.summary
      : typeof permission.message === "string"
        ? permission.message
        : "Live hosted-model status was exported without a diagnostic summary.",
  operatorChecks: Array.isArray(remediation.operatorChecks) ? remediation.operatorChecks : [],
  safeForPublicExport: true,
  rawArtifactTracked: false,
  rawArtifactPath: artifactPath,
  redactionAudit: {
    status: "PASS",
    envFileProvided: Boolean(envFilePath),
    checkedFiles: checkedFiles.map((filePath) => relative(process.cwd(), filePath)),
    checkedSecretValueCount: secretValues.length,
    leakedSecretNames: [],
    bearerSecretLeakFiles: []
  },
  deterministicAuthority: true,
  mutation: false
};

if (outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify(report, null, 2));
