import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import { traceEventSchema } from "../schemas/core.js";
import { parseMcpTranscriptRecords } from "../traces/mcp-transcript.js";

export interface ExternalTraceCertificationPayload {
  trace: z.infer<typeof traceEventSchema>[];
  requirePass: boolean;
  agentName?: string;
  agentVersion?: string;
}

export interface McpTranscriptCertificationPayload {
  transcript: string;
  finalAnswer: string;
  strictImport: boolean;
  requirePass: boolean;
  agentName?: string;
  agentVersion?: string;
}

export type ExternalCertificationPayload =
  | { kind: "external-trace"; value: ExternalTraceCertificationPayload }
  | { kind: "mcp-transcript"; value: McpTranscriptCertificationPayload };

const optionalName = z.string().trim().min(1).max(120).optional();

const externalTraceCertificationPayloadSchema = z
  .object({
    trace: traceEventSchema.array().min(1),
    requirePass: z.boolean().optional().default(false),
    agentName: optionalName,
    agentVersion: optionalName
  })
  .strict();

const mcpTranscriptCertificationPayloadSchema = z
  .object({
    transcript: z.string().trim().min(1, "MCP transcript is empty."),
    finalAnswer: z.string().trim().min(1, "MCP transcript certification requires a producer-provided final answer."),
    strictImport: z.boolean().optional().default(true),
    requirePass: z.boolean().optional().default(false),
    agentName: optionalName,
    agentVersion: optionalName
  })
  .strict();

const zodMessage = (result: z.SafeParseReturnType<unknown, unknown>, label: string): string => {
  if (result.success) {
    return label;
  }

  const first = result.error.issues[0];
  const path = first?.path.length ? first.path.join(".") : label;

  return `${path}: ${first?.message ?? "Invalid payload."}`;
};

export const parseExternalTraceCertificationPayload = (input: unknown): ExternalTraceCertificationPayload => {
  const result = externalTraceCertificationPayloadSchema.safeParse(input);

  if (!result.success) {
    throw new Error(`Invalid external trace upload: ${zodMessage(result, "trace")}`);
  }

  return result.data;
};

export const parseMcpTranscriptCertificationPayload = (input: unknown): McpTranscriptCertificationPayload => {
  const result = mcpTranscriptCertificationPayloadSchema.safeParse(input);

  if (!result.success) {
    throw new Error(`Invalid MCP transcript upload: ${zodMessage(result, "transcript")}`);
  }

  return result.data;
};

export const externalCertificationInputSummary = (payload: ExternalCertificationPayload): string => {
  if (payload.kind === "external-trace") {
    return `${payload.value.trace.length} trace event(s); requirePass=${payload.value.requirePass ? "true" : "false"}`;
  }

  return `MCP JSONL transcript; strictImport=${payload.value.strictImport ? "true" : "false"}; requirePass=${
    payload.value.requirePass ? "true" : "false"
  }`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

interface TranscriptEvidence {
  refs: Set<string>;
  counts: number[];
  timeWindow: { earliest: string; latest: string } | null;
}

const collectTranscriptEvidence = (input: unknown, evidence: TranscriptEvidence): void => {
  if (Array.isArray(input)) {
    for (const value of input) {
      collectTranscriptEvidence(value, evidence);
    }
    return;
  }

  if (!isRecord(input)) {
    return;
  }

  if (isRecord(input.timeWindow)) {
    const earliest = input.timeWindow.earliest;
    const latest = input.timeWindow.latest;

    if (typeof earliest === "string" && typeof latest === "string" && earliest.trim() && latest.trim()) {
      evidence.timeWindow = { earliest, latest };
    }
  }

  for (const [key, value] of Object.entries(input)) {
    if ((key === "eventRef" || key === "_cd") && typeof value === "string" && value.trim()) {
      evidence.refs.add(value);
    }

    if ((key === "resultCount" || key === "count") && typeof value === "number" && Number.isFinite(value)) {
      evidence.counts.push(value);
    }

    collectTranscriptEvidence(value, evidence);
  }
};

const evidenceFromTranscript = (
  transcript: string
): { evidenceRefs: string[]; resultCount: number | null; timeWindow: { earliest: string; latest: string } | null } => {
  const evidence: TranscriptEvidence = { refs: new Set<string>(), counts: [], timeWindow: null };

  for (const record of parseMcpTranscriptRecords(transcript)) {
    collectTranscriptEvidence(record, evidence);
  }

  return {
    evidenceRefs: [...evidence.refs],
    resultCount: evidence.counts.length > 0 ? evidence.counts.at(-1) ?? null : null,
    timeWindow: evidence.timeWindow
  };
};

const finalAnswerRecord = (finalAnswer: string, transcript: string): string => {
  const evidence = evidenceFromTranscript(transcript);

  return JSON.stringify({
    type: "final_answer",
    finalAnswer,
    resultCount: evidence.resultCount,
    evidenceRefs: evidence.evidenceRefs,
    timeWindow: evidence.timeWindow,
    timestamp: "2026-06-01T06:30:00.000Z"
  });
};

export const runExternalTraceCertificationWorkflow = async (
  input: { outDir: string; payload: ExternalTraceCertificationPayload },
  env: NodeJS.ProcessEnv = process.env
): Promise<{ artifacts: string[] }> => {
  const { runExternalTraceCertificationFromCli } = await import("../cli.js");
  const tracePath = join(input.outDir, "uploaded-external-trace.json");

  await writeFile(tracePath, `${JSON.stringify(input.payload.trace, null, 2)}\n`, "utf8");

  const result = await runExternalTraceCertificationFromCli(
    {
      outDir: input.outDir,
      tracePath,
      requirePass: input.payload.requirePass,
      agentName: input.payload.agentName,
      agentVersion: input.payload.agentVersion
    },
    env
  );

  return { artifacts: [tracePath, ...result.artifacts] };
};

export const runMcpTranscriptCertificationWorkflow = async (
  input: { outDir: string; payload: McpTranscriptCertificationPayload },
  env: NodeJS.ProcessEnv = process.env
): Promise<{ artifacts: string[] }> => {
  const { runMcpTranscriptCertificationFromCli } = await import("../cli.js");
  const transcriptPath = join(input.outDir, "uploaded-mcp-transcript.jsonl");
  const transcript = `${input.payload.transcript.trim()}\n${finalAnswerRecord(
    input.payload.finalAnswer,
    input.payload.transcript
  )}\n`;

  await writeFile(transcriptPath, transcript, "utf8");

  const result = await runMcpTranscriptCertificationFromCli(
    {
      outDir: input.outDir,
      transcriptPath,
      strictImport: input.payload.strictImport,
      requirePass: input.payload.requirePass,
      agentName: input.payload.agentName,
      agentVersion: input.payload.agentVersion
    },
    env
  );

  return { artifacts: [transcriptPath, ...result.artifacts] };
};
