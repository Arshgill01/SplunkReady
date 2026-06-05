import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { promisify } from "node:util";

import {
  environmentContractSchema,
  missionSchema,
  policyPatchSchema,
  readinessReceiptSchema,
  traceEventSchema,
  violationSchema
} from "../schemas/core.js";
import { redactText } from "../workbench/redaction.js";

const execFileAsync = promisify(execFile);

export interface PublicProofExportWorkflowInput {
  outDir: string;
  sourceRunId: string;
  sourceDir: string;
  sourceArtifactBase: string;
  exportArtifactBase: string;
}

export interface PublicProofExportWorkflowResult {
  artifacts: string[];
}

interface ExportedFile {
  path: string;
  sourcePath?: string;
  sizeBytes: number;
  sha256: string;
  redacted: true;
  schemaValidated: boolean;
}

const now = (): string => new Date().toISOString();

const hash = (input: string | Buffer): string => createHash("sha256").update(input).digest("hex");

const sensitiveKeyPattern = /(token|secret|password|credential|api[_-]?key|authorization)/i;
const rawErrorBodyKeyPattern = /^(?:raw|response)?body$|raw.*error|stack|cause/i;
const privateIpPattern = /\b(?:10(?:\.\d{1,3}){3}|127(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})\b/g;
const endpointUrlPattern = /https?:\/\/[^\s"'<>]+/gi;
const macUserPathPattern = /\/Users\/[^/"\s]+(?:\/[^"\s,;)]*)?/g;
const linuxUserPathPattern = /\/home\/[^/"\s]+(?:\/[^"\s,;)]*)?/g;
const windowsUserPathPattern = /[A-Za-z]:\\Users\\[^"\\\s]+(?:\\[^"\s,;)]*)?/g;

const redactPublicText = (input: string): string =>
  redactText(input)
    .replace(endpointUrlPattern, "https://[REDACTED-ENDPOINT]")
    .replace(privateIpPattern, "[REDACTED-IP]")
    .replace(macUserPathPattern, "/Users/[REDACTED]")
    .replace(linuxUserPathPattern, "/home/[REDACTED]")
    .replace(windowsUserPathPattern, "C:\\Users\\[REDACTED]");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const redactJsonValue = (input: unknown, key = ""): unknown => {
  if (sensitiveKeyPattern.test(key) || rawErrorBodyKeyPattern.test(key)) {
    return "[REDACTED]";
  }

  if (typeof input === "string") {
    return redactPublicText(input);
  }

  if (Array.isArray(input)) {
    return input.map((item) => redactJsonValue(item));
  }

  if (isRecord(input)) {
    return Object.fromEntries(Object.entries(input).map(([entryKey, value]) => [entryKey, redactJsonValue(value, entryKey)]));
  }

  return input;
};

const readOptionalJson = async (dir: string, fileName: string): Promise<unknown | undefined> => {
  try {
    return JSON.parse(await readFile(join(dir, fileName), "utf8")) as unknown;
  } catch {
    return undefined;
  }
};

const validateExportedJson = (fileName: string, value: unknown): boolean => {
  if (fileName === "environment-contract.json" || fileName === "live-smoke-contract.json") {
    environmentContractSchema.parse(value);
    return true;
  }

  if (fileName === "missions.json") {
    return missionSchema.array().safeParse(value).success;
  }

  if (fileName.startsWith("receipt-")) {
    readinessReceiptSchema.parse(value);
    return true;
  }

  if (fileName.startsWith("trace-")) {
    traceEventSchema.array().parse(value);
    return true;
  }

  if (fileName.startsWith("violations-")) {
    violationSchema.array().parse(value);
    return true;
  }

  if (fileName === "policy-patch.json") {
    policyPatchSchema.parse(value);
    return true;
  }

  return false;
};

const sourceFiles = [
  "environment-contract.json",
  "live-smoke-contract.json",
  "missions.json",
  "readiness-profile.json",
  "receipt-before-001.json",
  "receipt-after-001.json",
  "receipt-external-001.json",
  "trace-before.json",
  "trace-after.json",
  "trace-external.json",
  "trace-imported.json",
  "violations-before.json",
  "violations-after.json",
  "violations-external.json",
  "policy-patch.json",
  "proof-audit.json",
  "proof-manifest.json",
  "proof-manifest-verification.json",
  "live-proof-summary.json",
  "live-security-proof-summary.json",
  "suite-proof-summary.json",
  "hosted-model-proof.json",
  "hosted-model-diagnostic.json",
  "mcp-transcript-import.json",
  "firewall-block-before.json",
  "firewall-block-after.json"
] as const;

const exportedName = (sourceFile: string): string =>
  sourceFile === "proof-manifest.json" ? "source-proof-manifest.json" : sourceFile;

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const writeRedactedSourceFile = async (
  input: PublicProofExportWorkflowInput,
  fileName: string
): Promise<ExportedFile | undefined> => {
  const source = await readOptionalJson(input.sourceDir, fileName);

  if (source === undefined) {
    return undefined;
  }

  const redacted = redactJsonValue(source);
  const outputName = exportedName(fileName);
  const schemaValidated = validateExportedJson(fileName, redacted);
  const outputPath = join(input.outDir, outputName);

  await writeJson(outputPath, redacted);

  const content = await readFile(outputPath);

  return {
    path: outputName,
    sourcePath: fileName,
    sizeBytes: content.byteLength,
    sha256: hash(content),
    redacted: true,
    schemaValidated
  };
};

const gitCommit = async (): Promise<string> => {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--short=12", "HEAD"]);
    return stdout.trim() || "unknown";
  } catch {
    return "unknown";
  }
};

const collectFiles = async (root: string, current = root): Promise<string[]> => {
  const entries = await readdir(current, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(current, entry.name);

      if (entry.isDirectory()) {
        return collectFiles(root, path);
      }

      if (!entry.isFile() || entry.name === "proof-manifest.json" || entry.name === "proof-manifest-verification.json") {
        return [];
      }

      return [relative(root, path).split(sep).join("/")];
    })
  );

  return files.flat().sort();
};

const buildProofManifest = async (outDir: string): Promise<unknown> => {
  const files = await Promise.all(
    (await collectFiles(outDir)).map(async (path) => {
      const content = await readFile(join(outDir, path));

      return { path, sizeBytes: content.byteLength, sha256: hash(content) };
    })
  );
  const aggregateInput = files.map((file) => `${file.path}:${file.sizeBytes}:${file.sha256}`).join("\n");

  return {
    source: "splunkready-proof-manifest",
    generatedAt: now(),
    proofDir: outDir,
    aggregateSha256: hash(aggregateInput),
    files
  };
};

export const runPublicProofExportWorkflow = async (
  input: PublicProofExportWorkflowInput
): Promise<PublicProofExportWorkflowResult> => {
  await mkdir(input.outDir, { recursive: true });

  const exportedFiles = (
    await Promise.all(sourceFiles.map((fileName) => writeRedactedSourceFile(input, fileName)))
  ).filter((file): file is ExportedFile => Boolean(file));

  const receiptFile = exportedFiles.find((file) => file.path.startsWith("receipt-"));
  const traceFiles = exportedFiles.filter((file) => file.path.startsWith("trace-"));
  const includedPaths = new Set(exportedFiles.map((file) => file.sourcePath ?? file.path));
  const omittedFiles = sourceFiles.filter((fileName) => !includedPaths.has(fileName));

  if (!receiptFile && traceFiles.length === 0) {
    throw new Error("Public proof export requires at least one receipt or trace artifact.");
  }

  const summary = {
    source: "splunkready-public-proof-summary",
    generatedAt: now(),
    sourceRunId: input.sourceRunId,
    sourceArtifactBase: input.sourceArtifactBase,
    exportArtifactBase: input.exportArtifactBase,
    redactionStatus: "REDACTED",
    label: "Redacted public proof export",
    includedFiles: exportedFiles.map((file) => file.path).sort(),
    omittedFiles,
    receiptFiles: exportedFiles.filter((file) => file.path.startsWith("receipt-")).map((file) => file.path),
    traceFiles: traceFiles.map((file) => file.path),
    proofAuditIncluded: includedPaths.has("proof-audit.json"),
    policyPatchIncluded: includedPaths.has("policy-patch.json"),
    warning: "This bundle is sanitized for sharing. It is not the unredacted source proof bundle."
  };

  await writeJson(join(input.outDir, "public-proof-summary.json"), summary);
  await writeJson(join(input.outDir, "ui-artifacts.json"), {
    source: "splunkready-ui-artifacts",
    generatedAt: now(),
    defaultArtifact: input.exportArtifactBase,
    artifacts: [{ label: `Redacted export ${input.sourceRunId}`, path: input.exportArtifactBase }]
  });

  const summaryContent = await readFile(join(input.outDir, "public-proof-summary.json"));
  const uiArtifactsContent = await readFile(join(input.outDir, "ui-artifacts.json"));
  exportedFiles.push({
    path: "public-proof-summary.json",
    sizeBytes: summaryContent.byteLength,
    sha256: hash(summaryContent),
    redacted: true,
    schemaValidated: false
  });
  exportedFiles.push({
    path: "ui-artifacts.json",
    sizeBytes: uiArtifactsContent.byteLength,
    sha256: hash(uiArtifactsContent),
    redacted: true,
    schemaValidated: false
  });

  const aggregateInput = exportedFiles.map((file) => `${file.path}:${file.sizeBytes}:${file.sha256}`).sort().join("\n");
  const publicManifest = {
    source: "splunkready-public-proof-export",
    generatedAt: now(),
    sourceRunId: input.sourceRunId,
    sourceCommit: await gitCommit(),
    sourceArtifactBase: input.sourceArtifactBase,
    exportArtifactBase: input.exportArtifactBase,
    redactionStatus: "REDACTED",
    redaction: {
      secrets: "redacted",
      privateEndpoints: "redacted",
      privateIps: "redacted",
      userPaths: "redacted",
      rawMcpErrorBodies: "redacted"
    },
    aggregateSha256: hash(aggregateInput),
    files: exportedFiles.sort((left, right) => left.path.localeCompare(right.path))
  };

  await writeJson(join(input.outDir, "public-proof-export-manifest.json"), publicManifest);
  await writeJson(join(input.outDir, "proof-manifest.json"), await buildProofManifest(input.outDir));

  return {
    artifacts: [
      ...exportedFiles.map((file) => join(input.outDir, file.path)),
      join(input.outDir, "public-proof-export-manifest.json"),
      join(input.outDir, "ui-artifacts.json"),
      join(input.outDir, "proof-manifest.json")
    ]
  };
};
