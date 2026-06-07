import { generateKeyPairSync, sign as signData, verify as verifyData } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";

import { parseMissionDefinition } from "../missions/dsl.js";
import { generateReadinessReceipt } from "../receipts/generator.js";
import { canonicalJson, hashBuffer, receiptHash } from "../receipts/hash.js";
import {
  environmentContractSchema,
  readinessReceiptSchema,
  traceEventSchema,
  violationSchema,
  type ReadinessReceipt
} from "../schemas/core.js";

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
  chainDigest: string;
  receiptCount: number;
  publicKey: ReceiptChainPublicKey;
  signature: ReceiptChainSignature;
  entries: ReceiptChainEntry[];
  failures: string[];
}

export interface ReceiptChainSignature {
  algorithm: "ed25519";
  signedPayload: "chainDigest";
  status: "NOT_SIGNED" | "SIGNED" | "VERIFIED" | "INVALID";
  signatureBase64?: string;
  publicKeySha256?: string;
}

export interface ReceiptChainWorkflowInput {
  dir: string;
  publicKeyPath?: string;
  privateKeyPath?: string;
  generatedAt?: string;
}

export interface ReceiptChainWorkflowResult {
  status: ReceiptChainReport["status"];
  artifacts: string[];
  report: ReceiptChainReport;
}

export interface ReceiptReplayEntry {
  path: string;
  phase: "before" | "after";
  receiptId: string;
  previousReceiptHash: string | null;
  sourceReceiptHash: string;
  replayedReceiptHash: string;
  replayMatches: boolean;
}

export interface ReceiptReplayReport {
  source: "splunkready-receipt-replay";
  generatedAt: string;
  status: "PASS" | "FAIL";
  directory: string;
  mutation: false;
  deterministicAuthority: true;
  replayedReceiptCount: number;
  entries: ReceiptReplayEntry[];
  failures: string[];
}

export interface ReceiptReplayWorkflowResult {
  status: ReceiptReplayReport["status"];
  artifacts: string[];
  report: ReceiptReplayReport;
}

const defaultGeneratedAt = "2026-06-01T06:45:00.000Z";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const chainDigest = (entries: ReceiptChainEntry[]): string =>
  hashBuffer(
    Buffer.from(
      canonicalJson(
        entries.map((entry) => ({
          sequence: entry.sequence,
          path: entry.path,
          receiptId: entry.receiptId,
          previousReceiptHash: entry.previousReceiptHash,
          receiptHash: entry.receiptHash
        }))
      )
    )
  );

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
        entry.name === "receipt-replay.json" ||
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

const orderedReceiptPaths = async (dir: string): Promise<string[]> =>
  sortReceiptPaths((await collectReceiptFiles(dir)).map((path) => chainPath(dir, path)));

const readExistingSignature = async (dir: string): Promise<ReceiptChainSignature | undefined> => {
  const content = await readFile(join(dir, "receipt-chain.json"), "utf8").catch(() => undefined);

  if (!content) {
    return undefined;
  }

  const input = JSON.parse(content) as unknown;
  if (!isRecord(input) || !isRecord(input.signature)) {
    return undefined;
  }

  const signature = input.signature;
  if (
    signature.algorithm !== "ed25519" ||
    signature.signedPayload !== "chainDigest" ||
    typeof signature.signatureBase64 !== "string"
  ) {
    return undefined;
  }

  return {
    algorithm: "ed25519",
    signedPayload: "chainDigest",
    status: "SIGNED",
    signatureBase64: signature.signatureBase64,
    publicKeySha256: typeof signature.publicKeySha256 === "string" ? signature.publicKeySha256 : undefined
  };
};

const publicKeyStatus = async (publicKeyPath?: string): Promise<ReceiptChainPublicKey> => {
  if (!publicKeyPath) {
    return { path: "", status: "NOT_PROVIDED" };
  }

  const content = await readFile(publicKeyPath).catch(() => undefined);

  if (!content) {
    return { path: publicKeyPath, status: "MISSING" };
  }

  return { path: publicKeyPath, status: "PRESENT", sha256: hashBuffer(content) };
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const readJson = async (filePath: string): Promise<unknown> => JSON.parse(await readFile(filePath, "utf8"));

const verifySignature = (digest: string, publicKey: Buffer, signatureBase64: string): boolean =>
  verifyData(null, Buffer.from(digest, "utf8"), publicKey, Buffer.from(signatureBase64, "base64"));

const signDigest = (digest: string, privateKey: Buffer): string =>
  signData(null, Buffer.from(digest, "utf8"), privateKey).toString("base64");

const signatureFor = async (
  input: ReceiptChainWorkflowInput,
  digest: string,
  publicKey: ReceiptChainPublicKey,
  failures: string[]
): Promise<ReceiptChainSignature> => {
  if (input.privateKeyPath) {
    const privateKey = await readFile(input.privateKeyPath).catch(() => undefined);

    if (!privateKey) {
      failures.push(`Private key not found: ${input.privateKeyPath}`);
      return { algorithm: "ed25519", signedPayload: "chainDigest", status: "INVALID" };
    }

    const signatureBase64 = signDigest(digest, privateKey);
    if (publicKey.status === "PRESENT") {
      const publicKeyContent = await readFile(publicKey.path);
      if (!verifySignature(digest, publicKeyContent, signatureBase64)) {
        failures.push(`Private key does not match public key: ${publicKey.path}.`);
      }
    }

    return {
      algorithm: "ed25519",
      signedPayload: "chainDigest",
      status: "SIGNED",
      signatureBase64,
      publicKeySha256: publicKey.sha256
    };
  }

  const existingSignature = await readExistingSignature(input.dir);

  if (publicKey.status === "PRESENT") {
    if (!existingSignature?.signatureBase64) {
      failures.push(`Receipt chain is not signed; run sign-receipt before verifying with ${publicKey.path}.`);
      return { algorithm: "ed25519", signedPayload: "chainDigest", status: "INVALID" };
    }

    const publicKeyContent = await readFile(publicKey.path);
    const verified = verifySignature(digest, publicKeyContent, existingSignature.signatureBase64);

    if (!verified) {
      failures.push(`Receipt chain signature does not verify with ${publicKey.path}.`);
    }

    return {
      ...existingSignature,
      status: verified ? "VERIFIED" : "INVALID",
      publicKeySha256: publicKey.sha256
    };
  }

  return existingSignature ?? { algorithm: "ed25519", signedPayload: "chainDigest", status: "NOT_SIGNED" };
};

export const buildReceiptChainReport = async (input: ReceiptChainWorkflowInput): Promise<ReceiptChainReport> => {
  const receiptPaths = await orderedReceiptPaths(input.dir);
  const failures: string[] = [];
  let previousReceiptHash: string | null = null;
  const entries: ReceiptChainEntry[] = [];

  for (const [index, relativePath] of receiptPaths.entries()) {
    const filePath = join(input.dir, relativePath);

    try {
      const receipt = await readReceipt(filePath);
      const hash = receiptHash(receipt);

      if (receipt.receiptHash !== undefined && receipt.receiptHash !== hash) {
        failures.push(`${relativePath}: embedded receiptHash does not match canonical content hash.`);
      }

      if (receipt.previousReceiptHash !== undefined && receipt.previousReceiptHash !== previousReceiptHash) {
        failures.push(`${relativePath}: embedded previousReceiptHash does not match the preceding receipt hash.`);
      }

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

  const digest = chainDigest(entries);
  const signature = await signatureFor(input, digest, publicKey, failures);
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
    chainDigest: digest,
    receiptCount: entries.length,
    publicKey,
    signature,
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

export const annotateReceiptChainMetadata = async (dir: string): Promise<string[]> => {
  const receiptPaths = await orderedReceiptPaths(dir);
  const artifacts: string[] = [];
  let previousReceiptHash: string | null = null;

  for (const relativePath of receiptPaths) {
    const filePath = join(dir, relativePath);
    const receipt = await readReceipt(filePath);
    const hash = receiptHash(receipt);
    const annotated = readinessReceiptSchema.parse({
      ...receipt,
      receiptHash: hash,
      previousReceiptHash
    });

    await writeJson(filePath, annotated);
    artifacts.push(filePath);
    previousReceiptHash = hash;
  }

  return artifacts;
};

const receiptPhase = (path: string): "before" | "after" | undefined => {
  if (path.endsWith("receipt-before-001.json")) {
    return "before";
  }

  if (path.endsWith("receipt-after-001.json")) {
    return "after";
  }

  return undefined;
};

const replayReceipt = async (dir: string, relativePath: string): Promise<ReceiptReplayEntry> => {
  const phase = receiptPhase(relativePath);

  if (!phase) {
    throw new Error(`${relativePath}: unsupported receipt phase.`);
  }

  const receiptPath = join(dir, relativePath);
  const receiptDir = dirname(receiptPath);
  const sourceReceipt = await readReceipt(receiptPath);
  const environment = environmentContractSchema.parse(await readJson(join(receiptDir, "environment-contract.json")));
  const missions = (await readJson(join(receiptDir, "missions.json")) as unknown[]).map(parseMissionDefinition);
  const traceEvents = traceEventSchema.array().parse(await readJson(join(receiptDir, `trace-${phase}.json`)));
  const violations = violationSchema.array().parse(await readJson(join(receiptDir, `violations-${phase}.json`)));
  const replayed = generateReadinessReceipt({
    id: sourceReceipt.id,
    agent: sourceReceipt.agent,
    environment,
    missionSuiteVersion: sourceReceipt.missionSuiteVersion,
    missions,
    traceEvents,
    violations,
    policyPatchSummary: sourceReceipt.policyPatchSummary,
    rerunComparison: sourceReceipt.rerunComparison,
    previousReceiptHash: sourceReceipt.previousReceiptHash,
    generatedBy: sourceReceipt.generatedBy,
    notes: sourceReceipt.notes
  }).receipt;
  const sourceReceiptHash = receiptHash(sourceReceipt);
  const replayedReceiptHash = receiptHash(replayed);

  return {
    path: relativePath,
    phase,
    receiptId: sourceReceipt.id,
    previousReceiptHash: sourceReceipt.previousReceiptHash ?? null,
    sourceReceiptHash,
    replayedReceiptHash,
    replayMatches: sourceReceiptHash === replayedReceiptHash
  };
};

export const runReceiptReplayWorkflow = async (input: {
  dir: string;
  generatedAt?: string;
}): Promise<ReceiptReplayWorkflowResult> => {
  const receiptPaths = await orderedReceiptPaths(input.dir);
  const failures: string[] = [];
  const entries: ReceiptReplayEntry[] = [];

  for (const relativePath of receiptPaths) {
    try {
      const entry = await replayReceipt(input.dir, relativePath);

      entries.push(entry);
      if (!entry.replayMatches) {
        failures.push(`${relativePath}: replayed receipt hash does not match source receipt hash.`);
      }
    } catch (error) {
      failures.push(`${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (entries.length === 0) {
    failures.push("No replayable receipt-*.json files found.");
  }

  const report: ReceiptReplayReport = {
    source: "splunkready-receipt-replay",
    generatedAt: input.generatedAt ?? defaultGeneratedAt,
    status: failures.length === 0 ? "PASS" : "FAIL",
    directory: input.dir,
    mutation: false,
    deterministicAuthority: true,
    replayedReceiptCount: entries.length,
    entries,
    failures
  };
  const reportPath = join(input.dir, "receipt-replay.json");

  await writeJson(reportPath, report);

  return { status: report.status, artifacts: [reportPath], report };
};

export const initializeReceiptKeys = async (outDir: string): Promise<string[]> => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const privateKeyPath = join(outDir, "receipt-private-key.local.pem");
  const publicKeyPath = join(outDir, "receipt-public-key.pem");

  await mkdir(outDir, { recursive: true });
  await writeFile(
    privateKeyPath,
    privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
    { encoding: "utf8", mode: 0o600 }
  );
  await writeFile(publicKeyPath, publicKey.export({ format: "pem", type: "spki" }).toString(), "utf8");

  return [publicKeyPath, privateKeyPath];
};
