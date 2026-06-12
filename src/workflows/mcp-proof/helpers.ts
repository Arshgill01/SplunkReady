import { relative } from "node:path";
import { type JsonRpcError, type JsonRpcResponse } from "./client.js";

export const isJsonRpcError = (response: JsonRpcResponse): response is JsonRpcError => "error" in response;

export const asRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid MCP proof response for ${label}.`);
  }

  return value as Record<string, unknown>;
};

export const stringFromRecord = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];

  return typeof value === "string" ? value : "";
};

export const stringArrayFromRecord = (record: Record<string, unknown>, key: string): string[] => {
  const value = record[key];

  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
};

export const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export const safeRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export const collectEvidenceRefs = (value: unknown): string[] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const record = value as Record<string, unknown>;
  const directRefs = stringArray(record.evidenceRefs);
  const results = Array.isArray(record.results) ? record.results : [];
  const rows = Array.isArray(record.rows) ? record.rows : [];
  const resultRefs = results.flatMap((result) => {
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      return [];
    }

    const eventRef = (result as Record<string, unknown>).eventRef;
    return typeof eventRef === "string" ? [eventRef] : [];
  });
  const rowRefs = rows.flatMap((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return [];
    }

    const eventRef = (row as Record<string, unknown>).eventRef;
    return typeof eventRef === "string" ? [eventRef] : [];
  });

  return [...new Set([...directRefs, ...resultRefs, ...rowRefs])];
};

export const textFromMcpResource = (resource: Record<string, unknown>): string => {
  const contents = Array.isArray(resource.contents) ? resource.contents : [];

  return contents
    .map((content) => {
      if (!content || typeof content !== "object" || Array.isArray(content)) {
        return "";
      }

      const text = (content as Record<string, unknown>).text;

      return typeof text === "string" ? text : "";
    })
    .join("\n");
};

export const displayPath = (path: string): string => {
  const relativePath = relative(process.cwd(), path);

  if (!relativePath || relativePath.startsWith("..")) {
    return path;
  }

  return relativePath;
};
