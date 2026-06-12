import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, "../..");
const scriptPath = resolve(repoRoot, "scripts/audit-release-alignment.mjs");

const writeFixture = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-release-alignment-test-"));

const baseCurrentness = {
  source: "splunkready-public-package-currentness",
  status: "STALE",
  registry: {
    latestVersion: "0.1.9",
    localVersion: "0.1.9",
    localVersionPublished: true,
    latestMatchesLocal: true,
    latestGitHead: "published-head",
    packageInputGitHead: "new-head",
    packageInputPaths: ["package.json", "README.md", "src"],
    dirtyPackageInputs: [],
    gitHeadMatchesPackageInputs: false
  },
  publishedJudgeProof: { packageSpec: "splunkready@0.1.9", status: "PASS", command: "judge-proof" },
  publishedMcp: { packageSpec: "splunkready@0.1.9", status: "PASS", command: "mcp" },
  publishedLiveMockProof: { packageSpec: "splunkready@0.1.9", status: "PASS", command: "live-proof" },
  publishedRecorder: { packageSpec: "splunkready@0.1.9", status: "PASS", command: "mcp-recorder" },
  publishedPolicyRegistry: { packageSpec: "splunkready@0.1.9", status: "PASS", command: "policy-publish" },
  mutation: false,
  failures: []
};

describe("release alignment audit", () => {
  it("turns source-stale public package currentness into exact next release action", async () => {
    const root = await tempRoot();
    await writeFixture(join(root, "package.json"), { name: "splunkready", version: "0.1.9" });
    await writeFixture(
      join(root, "submission-evidence/public-package-currentness/public-package-currentness.json"),
      baseCurrentness
    );
    await writeFixture(join(root, "submission-evidence/npm-release-preflight/npm-release-preflight.json"), {
      source: "splunkready-npm-release-preflight",
      status: "BLOCKED",
      auth: { authenticated: false },
      registry: { status: "VERSION_ALREADY_PUBLISHED", currentVersionAvailable: false },
      blockers: ["npm auth is not configured; run npm adduser or npm login before publishing"],
      releaseCommand: "npm version patch && npm publish --access public",
      mutation: false
    });

    const result = await execFileAsync(process.execPath, [scriptPath], { cwd: root });
    const report = JSON.parse(result.stdout);

    expect(report.status).toBe("ACTION_REQUIRED");
    expect(report.package.recommendedNextVersion).toBe("0.1.10");
    expect(report.currentness.gitHeadMatchesPackageInputs).toBe(false);
    expect(report.releasePreflight.status).toBe("BLOCKED");
    expect(report.releasePreflight.authenticated).toBe(false);
    expect(report.releasePreflight.blockers).toContain(
      "npm auth is not configured; run npm adduser or npm login before publishing"
    );
    expect(report.nextCommands).toContain("npm publish --access public");
    await expect(readFile(join(root, "submission-evidence/release-alignment/release-alignment.json"), "utf8")).resolves.toContain(
      "splunkready-release-alignment"
    );
  });

  it("fails require-aligned while the public package is not source-current", async () => {
    const root = await tempRoot();
    await writeFixture(join(root, "package.json"), { name: "splunkready", version: "0.1.9" });
    await writeFixture(
      join(root, "submission-evidence/public-package-currentness/public-package-currentness.json"),
      baseCurrentness
    );

    await expect(execFileAsync(process.execPath, [scriptPath, "--require-aligned"], { cwd: root })).rejects.toMatchObject({
      code: 1
    });
  });
});
