// v2 helper: extends the v1 helper with a tool-registry probe and a stricter
// mutation-aware path. The original v1 helper is kept untouched so that
// gemini-authored suites can keep running on the v1 logs.

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";

export type LiveReceiptGrade =
  | "PASS"
  | "FAIL"
  | "SAIA_PASS"
  | "POLICY_VIOLATION"
  | "TIMEOUT";

export interface LiveReceipt {
  id: string;
  suite: string;
  grade: LiveReceiptGrade;
  signature: { status: "SIGNED" | "UNSIGNED"; digest: string | null };
  mcp_calls_made: number;
  zero_mutation_policy_triggered: boolean;
  timestamp: string;
  llm: { provider: "gemini"; model: string; output: string };
  saiaTrace?: { generatedSpl: string; prompt: string };
  deterministicAssertion: string;
  observations: Record<string, unknown>;
}

export interface LoggedMcpCall {
  tool: string;
  request: Record<string, unknown>;
  response?: unknown;
  error?: string;
  durationMs: number;
}

const envPath = ".splunkready-live.env";

export const hasLiveCredentials = async (): Promise<boolean> => {
  try {
    const raw = await readFile(envPath, "utf8");
    const env: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const withoutExport = trimmed.startsWith("export ") ? trimmed.slice("export ".length) : trimmed;
      const equals = withoutExport.indexOf("=");
      if (equals === -1) continue;
      const key = withoutExport.slice(0, equals).trim();
      let value = withoutExport.slice(equals + 1).trim();
      if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
        value = value.slice(1, -1);
      }
      if (key) env[key] = value;
    }
    return Boolean(env.SPLUNKREADY_SPLUNK_MCP_URL && env.SPLUNKREADY_SPLUNK_MCP_TOKEN && env.GEMINI_API_KEY);
  } catch {
    return false;
  }
};

const parseEnvLine = (line: string): [string, string] | null => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }
  const withoutExport = trimmed.startsWith("export ") ? trimmed.slice("export ".length) : trimmed;
  const equals = withoutExport.indexOf("=");
  if (equals === -1) {
    return null;
  }
  const key = withoutExport.slice(0, equals).trim();
  let value = withoutExport.slice(equals + 1).trim();
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    value = value.slice(1, -1);
  }
  return key ? [key, value] : null;
};

export const loadLiveEnv = async (): Promise<NodeJS.ProcessEnv> => {
  const env = { ...process.env };
  const raw = await readFile(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (parsed) {
      env[parsed[0]] = parsed[1];
      process.env[parsed[0]] = parsed[1];
    }
  }
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  for (const name of [
    "SPLUNKREADY_SPLUNK_MCP_URL",
    "SPLUNKREADY_SPLUNK_MCP_TOKEN",
    "GEMINI_API_KEY"
  ]) {
    if (!env[name]) {
      throw new Error(`Missing ${name}; live integration tests require real credentials from ${envPath}.`);
    }
  }
  return env;
};

export const createLiveLog = async (suite: string): Promise<string> => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join("logs", `live-test-v2-${suite}-${timestamp}.jsonl`);
  await mkdir(dirname(path), { recursive: true });
  return path;
};

const redact = (value: unknown): unknown => {
  if (typeof value === "string") {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
      .replace(/key=[A-Za-z0-9._-]+/g, "key=[REDACTED]");
  }
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        /token|authorization|password|apiKey/i.test(key) ? "[REDACTED]" : redact(entry)
      ])
    );
  }
  return value;
};

export const appendJsonl = async (path: string, entry: Record<string, unknown>): Promise<void> => {
  await appendFile(path, `${JSON.stringify(redact(entry))}\n`, "utf8");
};

const parseTextContent = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

export const rowsFromMcpPayload = (payload: unknown): Array<Record<string, unknown>> => {
  const output = extractMcpOutput(payload);
  if (Array.isArray(output)) {
    return output.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
  }
  if (output && typeof output === "object" && Array.isArray((output as { results?: unknown }).results)) {
    return ((output as { results: unknown[] }).results).filter(
      (row): row is Record<string, unknown> => Boolean(row) && typeof row === "object"
    );
  }
  return [];
};

export const extractMcpOutput = (payload: unknown): unknown => {
  if (!payload || typeof payload !== "object") {
    return payload;
  }
  const record = payload as Record<string, unknown>;
  const result = record.result;
  if (!result || typeof result !== "object") {
    return record.output ?? payload;
  }
  const resultRecord = result as Record<string, unknown>;
  if (resultRecord.structuredContent) {
    return resultRecord.structuredContent;
  }
  if (resultRecord.output) {
    return resultRecord.output;
  }
  if (Array.isArray(resultRecord.content)) {
    const textItem = resultRecord.content.find(
      (item): item is { text: string } =>
        Boolean(item) && typeof item === "object" && typeof (item as { text?: unknown }).text === "string"
    );
    if (textItem) {
      return parseTextContent(textItem.text);
    }
  }
  return result;
};

export const callMcp = async (input: {
  env: NodeJS.ProcessEnv;
  logPath: string;
  tool: string;
  arguments: Record<string, unknown>;
  defaultApp?: string;
  timeoutMs?: number;
}): Promise<LoggedMcpCall> => {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 30000);
  const request = {
    jsonrpc: "2.0",
    id: `live-test-v2:${input.tool}:${started}`,
    method: "tools/call",
    params: {
      name: input.tool,
      arguments: input.arguments,
      defaultApp: input.defaultApp ?? "search"
    }
  };

  try {
    const response = await fetch(input.env.SPLUNKREADY_SPLUNK_MCP_URL ?? "", {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.env.SPLUNKREADY_SPLUNK_MCP_TOKEN}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(request),
      signal: controller.signal
    });
    const payload = (await response.json()) as unknown;
    const entry = { tool: input.tool, request, response: payload, durationMs: Date.now() - started };
    await appendJsonl(input.logPath, { type: "mcp", ...entry });
    return entry;
  } catch (error) {
    const entry = {
      tool: input.tool,
      request,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started
    };
    await appendJsonl(input.logPath, { type: "mcp", ...entry });
    return entry;
  } finally {
    clearTimeout(timeout);
  }
};

export const callGemini = async (input: {
  env: NodeJS.ProcessEnv;
  logPath: string;
  prompt: string;
}): Promise<{ model: string; output: string }> => {
  const model = input.env.GEMINI_MODEL || input.env.SPLUNKREADY_LLM_MODEL || "gemini-3.1-flash-lite";
  const endpoint = input.env.SPLUNKREADY_GEMINI_ENDPOINT_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
  const url = `${endpoint}/models/${encodeURIComponent(model)}:generateContent?key=${input.env.GEMINI_API_KEY}`;
  const request = {
    contents: [{ role: "user", parts: [{ text: input.prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 256 }
  };
  let lastError = "Gemini request was not attempted.";

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const started = Date.now();
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request)
    });
    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    };
    await appendJsonl(input.logPath, {
      type: "llm",
      provider: "gemini",
      model,
      attempt,
      request: { prompt: input.prompt },
      response: payload,
      durationMs: Date.now() - started
    });

    if (response.ok) {
      const output = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
      if (!output) {
        throw new Error("Gemini returned no text output.");
      }
      return { model, output };
    }

    lastError = payload.error?.message ?? String(response.status);
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 4) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
  }

  throw new Error(`Gemini request failed: ${lastError}`);
};

export const listMcpTools = async (input: {
  env: NodeJS.ProcessEnv;
  logPath: string;
}): Promise<{ tools: string[]; error?: string; durationMs: number }> => {
  const started = Date.now();
  try {
    const response = await fetch(input.env.SPLUNKREADY_SPLUNK_MCP_URL ?? "", {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.env.SPLUNKREADY_SPLUNK_MCP_TOKEN}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: `live-test-v2:tools/list:${started}`, method: "tools/list", params: {} })
    });
    const payload = (await response.json()) as {
      result?: { tools?: Array<{ name: string }> };
      error?: { code?: number; message?: string };
    };
    const tools = (payload.result?.tools ?? []).map((t) => t.name).sort();
    const entry = {
      type: "mcp-registry",
      request: { method: "tools/list" },
      response: payload,
      tools,
      durationMs: Date.now() - started
    };
    await appendJsonl(input.logPath, entry);
    return { tools, durationMs: Date.now() - started };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await appendJsonl(input.logPath, {
      type: "mcp-registry",
      request: { method: "tools/list" },
      error: message,
      durationMs: Date.now() - started
    });
    return { tools: [], error: message, durationMs: Date.now() - started };
  }
};

export const cleanSpl = (raw: string): string =>
  raw
    .replace(/```[a-zA-Z-]*\n?/g, "")
    .replace(/```/g, "")
    .trim();

export const extractSplQuery = (raw: string): string => {
  // Prefer a fenced code block if present. SAIA commonly wraps its answer in
  // ```splunk-spl ... ``` or ```spl ... ```. We look at the *raw* text so the
  // fences survive; cleanSpl strips them.
  const fenced = raw.match(/```(?:splunk-spl|spl|splunk)?\s*([\s\S]+?)\s*```/i);
  if (fenced) {
    return cleanSpl(fenced[1]).trim();
  }
  const cleaned = cleanSpl(raw);
  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("*") && !line.startsWith("#") && !/^\d+\./.test(line));
  return lines.join("\n").trim();
};

export const issueReceipt = (
  input: Omit<LiveReceipt, "id" | "timestamp" | "signature"> & { signed: boolean }
): LiveReceipt => {
  const timestamp = new Date().toISOString();
  const id = `receipt-live-v2-${input.suite}-${timestamp.replace(/[:.]/g, "-")}`;
  const payload = JSON.stringify({ id, timestamp, ...input });
  const digest = createHash("sha256").update(payload).digest("hex");
  return {
    id,
    timestamp,
    suite: input.suite,
    grade: input.grade,
    signature: input.signed ? { status: "SIGNED", digest } : { status: "UNSIGNED", digest: null },
    mcp_calls_made: input.mcp_calls_made,
    zero_mutation_policy_triggered: input.zero_mutation_policy_triggered,
    llm: input.llm,
    saiaTrace: input.saiaTrace,
    deterministicAssertion: input.deterministicAssertion,
    observations: input.observations
  };
};
