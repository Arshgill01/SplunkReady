import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";

import { readinessReceiptSchema, type ReadinessReceipt } from "../schemas/core.js";

export interface ReceiptChainEntry {
  sequence: number;
  path: string;
  receiptId: string;
  verdict: string;
  score: number;
  previousReceiptHash: string | null;
  receiptHash: string;
  traceRefs: number;
  evidenceRefs: number;
}

export interface ReceiptChainPublicKey {
  path: string;
  status: "PRESENT" | "MISSING" | "NOT_PROVIDED";
  sha256?: string;
}

export interface ReceiptChainReport {
  source: "splunkready-receipt-chain";
  generatedAt: string;
  status: "PASS" | "FAIL";
  directory: string;
  algorithm: "sha256-canonical-json";
  mutation: false;
  deterministicAuthority: true;
  chainValid: boolean;
  receiptCount: number;
  publicKey: ReceiptChainPublicKey;
  entries: ReceiptChainEntry[];
  failures: string[];
}

export interface ReceiptChainWorkflowInput {
  dir: string;
  publicKeyPath?: string;
  generatedAt?: string;
}

export interface ReceiptChainWorkflowResult {
  status: ReceiptChainReport["status"];
  artifacts: string[];
  report: ReceiptChainReport;
}

const defaultGeneratedAt = "2026-06-01T06:45:00.000Z";

const sha256Hex = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
};

export const receiptHash = (receipt: ReadinessReceipt): string => sha256Hex(canonicalJson(receipt));

const chainPath = (rootDir: string, filePath: string): string => relative(rootDir, filePath).split(sep).join("/");

const collectReceiptFiles = async (rootDir: string, currentDir = rootDir): Promise<string[]> => {
  const entries = await readdir(currentDir, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(
    entries.map(async (entry) => {
      const filePath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        return collectReceiptFiles(rootDir, filePath);
      }

      if (
        !entry.isFile() ||
        entry.name === "receipt-chain.json" ||
        !entry.name.startsWith("receipt-") ||
        !entry.name.endsWith(".json")
      ) {
        return [];
      }

      return [filePath];
    })
  );

  return files.flat();
};

const phaseRank = (path: string): number => {
  if (path.endsWith("/receipt-before-001.json") || path === "receipt-before-001.json") {
    return 0;
  }

  if (path.endsWith("/receipt-after-001.json") || path === "receipt-after-001.json") {
    return 1;
  }

  return 2;
};

const sortReceiptPaths = (paths: string[]): string[] =>
  [...paths].sort((left, right) => {
    const leftDir = left.slice(0, left.lastIndexOf("/") + 1);
    const rightDir = right.slice(0, right.lastIndexOf("/") + 1);
    const dirOrder = leftDir.localeCompare(rightDir);

    if (dirOrder !== 0) {
      return dirOrder;
    }

    const rankOrder = phaseRank(left) - phaseRank(right);
    return rankOrder !== 0 ? rankOrder : left.localeCompare(right);
  });

const readReceipt = async (path: string): Promise<ReadinessReceipt> =>
  readinessReceiptSchema.parse(JSON.parse(await readFile(path, "utf8")));

const publicKeyStatus = async (publicKeyPath?: string): Promise<ReceiptChainPublicKey> => {
  if (!publicKeyPath) {
    return { path: "", status: "NOT_PROVIDED" };
  }

  const content = await readFile(publicKeyPath).catch(() => undefined);

  if (!content) {
    return { path: publicKeyPath, status: "MISSING" };
  }

  return { path: publicKeyPath, status: "PRESENT", sha256: sha256Hex(content) };
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export const buildReceiptChainReport = async (input: ReceiptChainWorkflowInput): Promise<ReceiptChainReport> => {
  const receiptPaths = sortReceiptPaths((await collectReceiptFiles(input.dir)).map((path) => chainPath(input.dir, path)));
  const failures: string[] = [];
  let previousReceiptHash: string | null = null;
  const entries: ReceiptChainEntry[] = [];

  for (const [index, relativePath] of receiptPaths.entries()) {
    const filePath = join(input.dir, relativePath);

    try {
      const receipt = await readReceipt(filePath);
      const hash = receiptHash(receipt);

      entries.push({
        sequence: index + 1,
        path: relativePath,
        receiptId: receipt.id,
        verdict: receipt.verdict,
        score: receipt.score,
        previousReceiptHash,
        receiptHash: hash,
        traceRefs: receipt.traceRefs.length,
        evidenceRefs: receipt.evidenceRefs.length
      });
      previousReceiptHash = hash;
    } catch (error) {
      failures.push(`${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (entries.length === 0) {
    failures.push("No receipt-*.json files found.");
  }

  const publicKey = await publicKeyStatus(input.publicKeyPath);
  if (publicKey.status === "MISSING") {
    failures.push(`Public key not found: ${publicKey.path}`);
  }

  const chainValid = failures.length === 0;

  return {
    source: "splunkready-receipt-chain",
    generatedAt: input.generatedAt ?? defaultGeneratedAt,
    status: chainValid ? "PASS" : "FAIL",
    directory: input.dir,
    algorithm: "sha256-canonical-json",
    mutation: false,
    deterministicAuthority: true,
    chainValid,
    receiptCount: entries.length,
    publicKey,
    entries,
    failures
  };
};

export const runReceiptChainWorkflow = async (input: ReceiptChainWorkflowInput): Promise<ReceiptChainWorkflowResult> => {
  const report = await buildReceiptChainReport(input);
  const reportPath = join(input.dir, "receipt-chain.json");

  await writeJson(reportPath, report);

  return { status: report.status, artifacts: [reportPath], report };
};
