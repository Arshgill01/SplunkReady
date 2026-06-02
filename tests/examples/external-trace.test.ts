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

const readJson = async <T>(url: URL): Promise<T> => JSON.parse(await readFile(url, "utf8")) as T;

describe("external trace example", () => {
  it("captures a schema-valid sample trace from the example script", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-example-trace-"));
    const generatedTracePath = join(outDir, "captured.json");

    await execFileAsync("node", ["examples/capture-external-trace.js", generatedTracePath]);

    const generated = JSON.parse(await readFile(generatedTracePath, "utf8")) as unknown;
    const checkedIn = await readJson<unknown>(sampleTracePath);

    expect(traceEventSchema.array().safeParse(generated).success).toBe(true);
    expect(generated).toEqual(checkedIn);
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
});
