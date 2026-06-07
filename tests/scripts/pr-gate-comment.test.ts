import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildPrGateSummary, renderPrGateComment, writePrGateComment } from "../../scripts/render-pr-gate-comment.mjs";

const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-pr-gate-comment-test-"));

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const writeProof = async (
  root: string,
  overrides: { mutation?: boolean; status?: string; auditStatus?: string; auditWarnings?: string[] } = {}
): Promise<string> => {
  const proofDir = join(root, "artifacts", "pr-gate");
  const mutation = overrides.mutation ?? false;
  const status = overrides.status ?? "PASS";

  await writeJson(join(proofDir, "live-proof-summary.json"), {
    status,
    mode: "live",
    mutation,
    proofLoop: "fail-to-pass",
    failToPass: true,
    before: { verdict: "NOT READY", score: 10, violations: 4 },
    after: { verdict: "READY", score: 100, violations: 0 },
    hostedModels: { status: "invoked", assistanceItems: 2 }
  });
  await writeJson(join(proofDir, "proof-audit.json"), {
    status: overrides.auditStatus ?? status,
    proofType: "live",
    mutation,
    failToPass: true,
    readyAfterPatch: true,
    checks: [
      { id: "live-proof-status", status: "PASS" },
      ...(overrides.auditWarnings ?? []).map((id) => ({ id, status: "WARN" }))
    ]
  });
  await writeJson(join(proofDir, "receipt-before-001.json"), {
    verdict: "NOT READY",
    score: 10,
    violations: [{ id: "v-1" }, { id: "v-2" }, { id: "v-3" }, { id: "v-4" }]
  });
  await writeJson(join(proofDir, "receipt-after-001.json"), {
    verdict: "READY",
    score: 100,
    violations: []
  });
  await writeJson(join(proofDir, "policy-patch.json"), {
    id: "patch-security-readiness",
    rules: [{ id: "rule-1" }, { id: "rule-2" }, { id: "rule-3" }],
    violationRefs: ["v-1", "v-2", "v-3", "v-4"]
  });

  return proofDir;
};

describe("PR gate comment renderer", () => {
  it("renders a deterministic live readiness comment and JSON summary", async () => {
    const root = await tempRoot();
    await writeProof(root);

    const result = await writePrGateComment({
      repoRoot: root,
      proofDir: "artifacts/pr-gate",
      outPath: "artifacts/pr-gate/pr-comment.md",
      jsonOutPath: "artifacts/pr-gate/ci-pr-gate.json"
    });

    expect(result.summary).toMatchObject({
      source: "splunkready-live-readiness-pr-gate",
      status: "PASS",
      mode: "live",
      mutation: false,
      proofLoop: "fail-to-pass",
      failToPass: true,
      before: { verdict: "NOT READY", score: 10, violations: 4 },
      after: { verdict: "READY", score: 100, violations: 0 },
      policy: { patchId: "patch-security-readiness", ruleCount: 3, violationRefs: 4 }
    });
    expect(result.comment).toContain("<!-- splunkready-live-readiness-pr-gate -->");
    expect(result.comment).toContain("| Mutation | No |");
    expect(result.comment).toContain("| Before | NOT READY / 10/100 / 4 violation(s) |");
    expect(result.comment).toContain("| After | READY / 100/100 / 0 violation(s) |");
    expect(await readFile(join(root, "artifacts", "pr-gate", "pr-comment.md"), "utf8")).toBe(result.comment);

    const json = JSON.parse(await readFile(join(root, "artifacts", "pr-gate", "ci-pr-gate.json"), "utf8"));
    expect(json.artifacts.summary).toBe("artifacts/pr-gate/live-proof-summary.json");
  });

  it("fails closed when the proof reports mutation", async () => {
    const root = await tempRoot();
    await writeProof(root, { mutation: true });

    await expect(buildPrGateSummary({ repoRoot: root, proofDir: "artifacts/pr-gate" })).rejects.toThrow(
      "live proof must report mutation=false"
    );
  });

  it("accepts the generic live-proof audit warning without accepting arbitrary warnings", async () => {
    const root = await tempRoot();
    await writeProof(root, { auditStatus: "WARN", auditWarnings: ["live-security-summary"] });

    await expect(buildPrGateSummary({ repoRoot: root, proofDir: "artifacts/pr-gate" })).resolves.toMatchObject({
      status: "PASS",
      audit: { status: "WARN" }
    });
    const summary = await buildPrGateSummary({ repoRoot: root, proofDir: "artifacts/pr-gate" });
    expect(renderPrGateComment(summary)).toContain("WARN (generic live proof; not flagship live-security proof)");

    const badRoot = await tempRoot();
    await writeProof(badRoot, { auditStatus: "WARN", auditWarnings: ["mutation-unknown"] });

    await expect(buildPrGateSummary({ repoRoot: badRoot, proofDir: "artifacts/pr-gate" })).rejects.toThrow(
      "proof audit status must be PASS or only warn on live-security-summary"
    );
  });

  it("keeps the rendered comment stable for the same summary", async () => {
    const root = await tempRoot();
    const proofDir = await writeProof(root);
    const summary = await buildPrGateSummary({ repoRoot: root, proofDir, generatedAt: "2026-06-07T00:00:00.000Z" });

    expect(renderPrGateComment(summary)).toBe(renderPrGateComment(summary));
  });
});
