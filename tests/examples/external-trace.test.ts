import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { traceEventSchema, violationSchema } from "../../src/schemas/core.js";

const execFileAsync = promisify(execFile);
const sampleTracePath = new URL("../../examples/sample-external-trace.json", import.meta.url);
const sampleReceiptPath = new URL("../../examples/sample-receipt.md", import.meta.url);
const sampleViolationsPath = new URL("../../examples/sample-violations.json", import.meta.url);
const samplePassTracePath = new URL("../../examples/sample-external-trace-pass.json", import.meta.url);
const samplePassReceiptPath = new URL("../../examples/sample-pass-receipt.md", import.meta.url);
const samplePassViolationsPath = new URL("../../examples/sample-pass-violations.json", import.meta.url);

const readJson = async <T>(url: URL): Promise<T> => JSON.parse(await readFile(url, "utf8")) as T;

describe("external trace example", () => {
  it("captures a schema-valid sample trace from the example script", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-example-trace-"));
    const generatedTracePath = join(outDir, "captured.json");
    const generatedPassTracePath = join(outDir, "captured-pass.json");

    await execFileAsync("node", ["examples/capture-external-trace.js", generatedTracePath]);
    await execFileAsync("node", ["examples/capture-external-trace.js", generatedPassTracePath, "pass"]);

    const generated = JSON.parse(await readFile(generatedTracePath, "utf8")) as unknown;
    const checkedIn = await readJson<unknown>(sampleTracePath);
    const generatedPass = JSON.parse(await readFile(generatedPassTracePath, "utf8")) as unknown;
    const checkedInPass = await readJson<unknown>(samplePassTracePath);

    expect(traceEventSchema.array().safeParse(generated).success).toBe(true);
    expect(traceEventSchema.array().safeParse(generatedPass).success).toBe(true);
    expect(generated).toEqual(checkedIn);
    expect(generatedPass).toEqual(checkedInPass);
  });

  it("keeps a generated sample receipt with deterministic external-trace violations", async () => {
    const violations = await readJson<unknown>(sampleViolationsPath);
    const receiptMarkdown = await readFile(sampleReceiptPath, "utf8");
    const parsedViolations = violationSchema.array().parse(violations);

    expect(parsedViolations.map((violation) => violation.ruleId)).toEqual([
      "SPL-001",
      "SPL-003",
      "KO-001",
      "EVD-001",
      "ANS-001"
    ]);
    expect(receiptMarkdown).toContain("External MCP Agent example-trace-001");
    expect(receiptMarkdown).toContain("Verdict: NOT READY");
    expect(receiptMarkdown).toContain("deterministic rule engine decides pass/fail");
  });

  it("keeps a generated sample receipt for a contract-aware external trace", async () => {
    const violations = await readJson<unknown>(samplePassViolationsPath);
    const receiptMarkdown = await readFile(samplePassReceiptPath, "utf8");
    const parsedViolations = violationSchema.array().parse(violations);

    expect(parsedViolations).toEqual([]);
    expect(receiptMarkdown).toContain("External MCP Agent example-trace-pass-001");
    expect(receiptMarkdown).toContain("Verdict: READY");
    expect(receiptMarkdown).toContain("Score: 100");
    expect(receiptMarkdown).toContain("saved-search-lateral-movement");
    expect(receiptMarkdown).toContain("deterministic rule engine decides pass/fail");
  });
});
