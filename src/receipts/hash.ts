import { createHash } from "node:crypto";

import type { ReadinessReceipt } from "../schemas/core.js";

const sha256Hex = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
};

export const receiptContent = (receipt: ReadinessReceipt): Omit<ReadinessReceipt, "receiptHash" | "previousReceiptHash"> => {
  const { receiptHash: _receiptHash, previousReceiptHash: _previousReceiptHash, ...content } = receipt;

  return content;
};

export const receiptHash = (receipt: ReadinessReceipt): string => sha256Hex(canonicalJson(receiptContent(receipt)));

export const hashBuffer = (value: Buffer): string => sha256Hex(value);
