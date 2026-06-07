import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";

export interface SplunkReceiptStoreProofInput {
  outDir: string;
  receiptDir: string;
  confirmWrite: boolean;
  envFileUsed?: boolean;
  fetch?: typeof fetch;
  generatedAt?: string;
}

export interface SplunkReceiptStoreProofResult {
  status: "PASS" | "SKIP" | "BLOCKED";
  artifacts: string[];
  messages: string[];
}

interface ReceiptChainEntry {
  sequence: number;
  path: string;
  receiptId: string;
  verdict: string;
  score: number;
  previousReceiptHash: string | null;
  receiptHash: string;
}

interface ReceiptChain {
  source: string;
  status: string;
  chainValid: boolean;
  chainDigest: string;
  receiptCount: number;
  entries: ReceiptChainEntry[];
}

interface ReceiptSummaryRow {
  _key: string;
  receipt_id: string;
  receipt_hash: string;
  previous_receipt_hash: string;
  verdict: string;
  score: number;
  mutation: boolean;
  policy_id: string;
  policy_version: string;
  source: string;
  updated_at: number;
}

interface SplunkReceiptStoreProof {
  source: "splunkready-operator-receipt-kv-ingestion-proof";
  status: "PASS" | "SKIP" | "BLOCKED";
  generatedAt: string;
  appId: "SplunkReady";
  mutation: false;
  splunkMutation: "none" | "operator-approved-receipt-store-write";
  defaultProofMutation: false;
  operatorApproved: boolean;
  receiptSource: {
    directory: string;
    chainStatus: string | null;
    chainValid: boolean;
    chainDigest: string | null;
    receiptCount: number;
  };
  config: {
    envFileUsed: boolean;
    managementUrlConfigured: boolean;
    managementUrlDerivedFromMcpUrl: boolean;
    usernameConfigured: boolean;
    passwordConfigured: boolean;
    tokenConfigured: boolean;
    missing: string[];
  };
  write: {
    attempted: boolean;
    status: "SKIP" | "PASS" | "BLOCKED";
    requestedRows: number;
    deletedRows: number;
    writtenRows: number;
    statusCodes: number[];
  };
  lookup: {
    attempted: boolean;
    status: "SKIP" | "PASS" | "BLOCKED";
    rowCount: number;
    matchedHashes: string[];
    missingHashes: string[];
    statusCode: number | null;
  };
  rows: Array<{
    key: string;
    receiptId: string;
    receiptHash: string;
    previousReceiptHash: string | null;
    verdict: string;
    score: number;
    mutation: false;
    policyId: string;
    policyVersion: string;
    source: string;
  }>;
  redaction: {
    secretValuesWritten: false;
    endpointValueWritten: false;
    usernameValueWritten: false;
    rawTraceValuesWritten: false;
  };
}

const source = "splunkready-operator-receipt-kv-ingestion-proof" as const;
const appId = "SplunkReady" as const;
const collectionName = "splunkready_receipts";
const lookupName = "splunkready_receipts_lookup";
const defaultGeneratedAt = "2026-06-01T06:45:00.000Z";
const defaultReceiptDir = "submission-evidence/suite-proof";

const managementUrlEnvNames = [
  "SPLUNKREADY_SPLUNK_MANAGEMENT_URL",
  "SPLUNKREADY_SPLUNKD_URL",
  "SPLUNK_MANAGEMENT_URL",
  "SPLUNKD_URL"
];
const mcpUrlEnvNames = ["SPLUNKREADY_SPLUNK_MCP_URL", "SPLUNK_MCP_URL"];
const usernameEnvNames = ["SPLUNKREADY_SPLUNK_USERNAME", "SPLUNK_USERNAME"];
const passwordEnvNames = ["SPLUNKREADY_SPLUNK_PASSWORD", "SPLUNK_PASSWORD"];
const tokenEnvNames = ["SPLUNKREADY_SPLUNK_SESSION_TOKEN", "SPLUNK_SESSION_TOKEN"];

const firstEnvValue = (env: NodeJS.ProcessEnv, names: string[]): string | undefined =>
  names.map((name) => env[name]?.trim()).find((value): value is string => Boolean(value));

const deriveManagementUrlFromMcpUrl = (env: NodeJS.ProcessEnv): string | undefined => {
  const rawUrl = firstEnvValue(env, mcpUrlEnvNames);

  if (!rawUrl) {
    return undefined;
  }

  try {
    return new URL(rawUrl).origin;
  } catch {
    return undefined;
  }
};

const normalizeBaseUrl = (rawUrl: string): string => rawUrl.replace(/\/+$/, "");

const authHeaderFromEnv = (env: NodeJS.ProcessEnv): { header?: string; usernameConfigured: boolean; passwordConfigured: boolean; tokenConfigured: boolean } => {
  const token = firstEnvValue(env, tokenEnvNames);
  const username = firstEnvValue(env, usernameEnvNames);
  const password = firstEnvValue(env, passwordEnvNames);

  if (token) {
    return {
      header: `Splunk ${token}`,
      usernameConfigured: Boolean(username),
      passwordConfigured: Boolean(password),
      tokenConfigured: true
    };
  }

  if (username && password) {
    return {
      header: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
      usernameConfigured: true,
      passwordConfigured: true,
      tokenConfigured: false
    };
  }

  return {
    usernameConfigured: Boolean(username),
    passwordConfigured: Boolean(password),
    tokenConfigured: false
  };
};

const publicSafePath = (path: string): string => {
  const resolved = resolve(path);
  const relativePath = relative(process.cwd(), resolved);

  if (!relativePath.startsWith("..") && !relativePath.startsWith("/")) {
    return relativePath;
  }

  return basename(path);
};

const requestSplunk = async (
  input: {
    baseUrl: string;
    path: string;
    method: "DELETE" | "GET" | "POST";
    authHeader: string;
    fetchImpl: typeof fetch;
    body?: URLSearchParams | string;
    contentType?: string;
  }
): Promise<Response> => {
  return input.fetchImpl(`${input.baseUrl}${input.path}`, {
    method: input.method,
    headers: {
      Authorization: input.authHeader,
      ...(input.body ? { "Content-Type": input.contentType ?? "application/x-www-form-urlencoded" } : {})
    },
    body: input.body
  });
};

const readReceiptChain = async (receiptDir: string): Promise<ReceiptChain> => {
  const chainPath = join(receiptDir, "receipt-chain.json");
  return JSON.parse(await readFile(chainPath, "utf8")) as ReceiptChain;
};

const readReceiptPolicyVersion = async (receiptDir: string, path: string): Promise<string> => {
  try {
    const receipt = JSON.parse(await readFile(join(receiptDir, path), "utf8")) as {
      contractVersion?: string;
      missionSuiteVersion?: string;
    };
    return receipt.contractVersion ?? receipt.missionSuiteVersion ?? "unknown";
  } catch {
    return "unknown";
  }
};

const rowsFromReceiptChain = async (receiptDir: string, chain: ReceiptChain, generatedAt: string): Promise<ReceiptSummaryRow[]> => {
  const rows: ReceiptSummaryRow[] = [];
  const updatedAt = Math.floor(Date.parse(generatedAt) / 1000);

  for (const entry of chain.entries.slice(0, 10)) {
    const policyVersion = await readReceiptPolicyVersion(receiptDir, entry.path);
    rows.push({
      _key: `splunkready-${entry.sequence}-${entry.receiptHash.slice(0, 12)}`,
      receipt_id: `${entry.sequence}-${entry.receiptId}`,
      receipt_hash: entry.receiptHash,
      previous_receipt_hash: entry.previousReceiptHash ?? "",
      verdict: entry.verdict,
      score: entry.score,
      mutation: false,
      policy_id: "default-readiness-policy",
      policy_version: policyVersion,
      source: entry.path,
      updated_at: Number.isFinite(updatedAt) ? updatedAt : 0
    });
  }

  return rows;
};

const parseExportResults = (body: string): Array<Record<string, unknown>> => {
  const trimmed = body.trim();

  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed) as { results?: Array<Record<string, unknown>>; result?: Record<string, unknown> };
    if (Array.isArray(parsed.results)) {
      return parsed.results;
    }
    if (parsed.result) {
      return [parsed.result];
    }
  } catch {
    // Splunk search export returns newline-delimited JSON in many deployments.
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as { result?: Record<string, unknown> };
        return parsed.result ? [parsed.result] : [];
      } catch {
        return [];
      }
    });
};

const writeProof = async (outDir: string, proof: SplunkReceiptStoreProof): Promise<string[]> => {
  await mkdir(outDir, { recursive: true });
  const jsonPath = join(outDir, "splunk-receipt-store-proof.json");
  const markdownPath = join(outDir, "splunk-receipt-store-proof.md");
  await writeFile(jsonPath, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  await writeFile(
    markdownPath,
    [
      "# Splunk Receipt Store Proof",
      "",
      `Status: ${proof.status}`,
      `Operator approved: ${proof.operatorApproved}`,
      `Splunk mutation: ${proof.splunkMutation}`,
      `Rows requested: ${proof.write.requestedRows}`,
      `Rows written: ${proof.write.writtenRows}`,
      `Lookup matched hashes: ${proof.lookup.matchedHashes.length}/${proof.write.requestedRows}`,
      "",
      "Only public-safe receipt summary fields are written. No endpoint, username, password, token, raw trace, or raw Splunk event values are written by this artifact."
    ].join("\n"),
    "utf8"
  );
  return [jsonPath, markdownPath];
};

const proofBase = async (
  input: SplunkReceiptStoreProofInput,
  env: NodeJS.ProcessEnv,
  chain: ReceiptChain | null,
  rows: ReceiptSummaryRow[]
): Promise<Omit<SplunkReceiptStoreProof, "status" | "write" | "lookup">> => {
  const managementUrl = firstEnvValue(env, managementUrlEnvNames);
  const derivedManagementUrl = managementUrl ? undefined : deriveManagementUrlFromMcpUrl(env);
  const auth = authHeaderFromEnv(env);
  const missing: string[] = [];

  if (!input.confirmWrite) {
    missing.push("--confirm-write true");
  }

  if (!managementUrl && !derivedManagementUrl) {
    missing.push(`${managementUrlEnvNames[0]} or ${mcpUrlEnvNames[0]}`);
  }

  if (!auth.header) {
    missing.push(`${tokenEnvNames[0]} or ${usernameEnvNames[0]} + ${passwordEnvNames[0]}`);
  }

  if (!chain || chain.status !== "PASS" || !chain.chainValid) {
    missing.push("valid receipt-chain.json");
  }

  return {
    source,
    generatedAt: input.generatedAt ?? defaultGeneratedAt,
    appId,
    mutation: false,
    splunkMutation: input.confirmWrite ? "operator-approved-receipt-store-write" : "none",
    defaultProofMutation: false,
    operatorApproved: input.confirmWrite,
    receiptSource: {
      directory: publicSafePath(input.receiptDir || defaultReceiptDir),
      chainStatus: chain?.status ?? null,
      chainValid: Boolean(chain?.chainValid),
      chainDigest: chain?.chainDigest ?? null,
      receiptCount: chain?.receiptCount ?? 0
    },
    config: {
      envFileUsed: Boolean(input.envFileUsed),
      managementUrlConfigured: Boolean(managementUrl || derivedManagementUrl),
      managementUrlDerivedFromMcpUrl: Boolean(!managementUrl && derivedManagementUrl),
      usernameConfigured: auth.usernameConfigured,
      passwordConfigured: auth.passwordConfigured,
      tokenConfigured: auth.tokenConfigured,
      missing
    },
    rows: rows.map((row) => ({
      key: row._key,
      receiptId: row.receipt_id,
      receiptHash: row.receipt_hash,
      previousReceiptHash: row.previous_receipt_hash || null,
      verdict: row.verdict,
      score: row.score,
      mutation: false,
      policyId: row.policy_id,
      policyVersion: row.policy_version,
      source: row.source
    })),
    redaction: {
      secretValuesWritten: false,
      endpointValueWritten: false,
      usernameValueWritten: false,
      rawTraceValuesWritten: false
    }
  };
};

export const runSplunkReceiptStoreProofWorkflow = async (
  input: SplunkReceiptStoreProofInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<SplunkReceiptStoreProofResult> => {
  const outDir = input.outDir || "submission-evidence/splunk-receipt-store";
  const receiptDir = resolve(input.receiptDir || defaultReceiptDir);
  const generatedAt = input.generatedAt ?? defaultGeneratedAt;
  let chain: ReceiptChain | null = null;
  let rows: ReceiptSummaryRow[] = [];

  try {
    chain = await readReceiptChain(receiptDir);
    rows = await rowsFromReceiptChain(receiptDir, chain, generatedAt);
  } catch {
    chain = null;
  }

  const base = await proofBase({ ...input, receiptDir }, env, chain, rows);
  const managementUrl = firstEnvValue(env, managementUrlEnvNames) ?? deriveManagementUrlFromMcpUrl(env);
  const auth = authHeaderFromEnv(env);

  if (base.config.missing.length > 0 || !managementUrl || !auth.header || !chain) {
    const proof: SplunkReceiptStoreProof = {
      ...base,
      status: "SKIP",
      write: {
        attempted: false,
        status: "SKIP",
        requestedRows: rows.length,
        deletedRows: 0,
        writtenRows: 0,
        statusCodes: []
      },
      lookup: {
        attempted: false,
        status: "SKIP",
        rowCount: 0,
        matchedHashes: [],
        missingHashes: rows.map((row) => row.receipt_hash),
        statusCode: null
      }
    };
    const artifacts = await writeProof(outDir, proof);
    return {
      status: "SKIP",
      artifacts,
      messages: ["SKIP splunk-receipt-store-proof: missing operator confirmation, live management configuration, or a valid receipt chain."]
    };
  }

  const fetchImpl = input.fetch ?? fetch;
  const baseUrl = normalizeBaseUrl(managementUrl);
  const statusCodes: number[] = [];
  let deletedRows = 0;
  let writtenRows = 0;

  for (const row of rows) {
    const keyPath = `/servicesNS/nobody/${appId}/storage/collections/data/${collectionName}/${encodeURIComponent(row._key)}`;
    const deleteResponse = await requestSplunk({
      baseUrl,
      path: `${keyPath}?output_mode=json`,
      method: "DELETE",
      authHeader: auth.header,
      fetchImpl
    });
    statusCodes.push(deleteResponse.status);

    if (deleteResponse.ok || deleteResponse.status === 404) {
      deletedRows += 1;
    }

    const writeResponse = await requestSplunk({
      baseUrl,
      path: `/servicesNS/nobody/${appId}/storage/collections/data/${collectionName}?output_mode=json`,
      method: "POST",
      authHeader: auth.header,
      fetchImpl,
      body: JSON.stringify(row),
      contentType: "application/json"
    });
    statusCodes.push(writeResponse.status);

    if (writeResponse.ok) {
      writtenRows += 1;
    }
  }

  const search = [
    `| inputlookup ${lookupName}`,
    "| fields receipt_id receipt_hash verdict score mutation policy_id policy_version source updated_at"
  ].join("\n");
  const lookupResponse = await requestSplunk({
    baseUrl,
    path: "/services/search/jobs/export",
    method: "POST",
    authHeader: auth.header,
    fetchImpl,
    body: new URLSearchParams({
      search,
      output_mode: "json"
    })
  });
  const lookupResults = parseExportResults(await lookupResponse.text());
  const expectedHashes = rows.map((row) => row.receipt_hash);
  const foundHashes = new Set(
    lookupResults
      .map((row) => (typeof row.receipt_hash === "string" ? row.receipt_hash : undefined))
      .filter((hash): hash is string => Boolean(hash))
  );
  const matchedHashes = expectedHashes.filter((hash) => foundHashes.has(hash));
  const missingHashes = expectedHashes.filter((hash) => !foundHashes.has(hash));
  const writePassed = writtenRows === rows.length && deletedRows === rows.length;
  const lookupPassed = lookupResponse.ok && missingHashes.length === 0;
  const status = writePassed && lookupPassed ? "PASS" : "BLOCKED";
  const proof: SplunkReceiptStoreProof = {
    ...base,
    status,
    write: {
      attempted: true,
      status: writePassed ? "PASS" : "BLOCKED",
      requestedRows: rows.length,
      deletedRows,
      writtenRows,
      statusCodes
    },
    lookup: {
      attempted: true,
      status: lookupPassed ? "PASS" : "BLOCKED",
      rowCount: lookupResults.length,
      matchedHashes,
      missingHashes,
      statusCode: lookupResponse.status
    }
  };
  const artifacts = await writeProof(outDir, proof);

  return {
    status,
    artifacts,
    messages: [
      status === "PASS"
        ? "PASS splunk-receipt-store-proof: receipt summaries were written and read back through the Splunk lookup."
        : "BLOCKED splunk-receipt-store-proof: receipt write or lookup readback did not pass."
    ]
  };
};
