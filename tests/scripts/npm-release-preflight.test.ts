import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, "../..");
const scriptPath = resolve(repoRoot, "scripts/audit-npm-release-preflight.mjs");

const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-npm-preflight-test-"));

const writeFixture = async (path: string, value: string, mode?: number): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");

  if (mode !== undefined) {
    await chmod(path, mode);
  }
};

const createFakeNpm = async (root: string): Promise<string> => {
  const binDir = join(root, "bin");
  const npmPath = join(binDir, "npm");

  await writeFixture(
    npmPath,
    `#!/usr/bin/env node
const args = process.argv.slice(2);

if (args[0] === "whoami") {
  console.log("fixture-user");
  process.exit(0);
}

if (args[0] === "view") {
  console.log(JSON.stringify(["0.1.0"]));
  process.exit(0);
}

if (args[0] === "pack") {
  console.log(JSON.stringify([{ filename: "splunkready-0.1.0.tgz", files: [{ path: "package.json" }, { path: "dist/src/cli.js" }] }]));
  process.exit(0);
}

console.error("unexpected npm command: " + args.join(" "));
process.exit(1);
`,
    0o755
  );

  return binDir;
};

const runPreflight = async (root: string, args: string[] = []) => {
  const binDir = await createFakeNpm(root);
  const result = await execFileAsync(process.execPath, [scriptPath, ...args], {
    cwd: root,
    env: { ...process.env, PATH: `${binDir}:${process.env.PATH ?? ""}` }
  });

  return JSON.parse(result.stdout) as {
    status: string;
    registry: { status: string; currentVersionAvailable: boolean };
    publishedPackage: string | null;
    releaseCommand: string;
    failures: string[];
  };
};

const writePackageJson = async (root: string, version: string): Promise<void> => {
  await writeFixture(
    join(root, "package.json"),
    `${JSON.stringify(
      {
        name: "splunkready",
        version,
        publishConfig: { access: "public" }
      },
      null,
      2
    )}\n`
  );
};

describe("npm release preflight", () => {
  it("reports the current version as published instead of failing release evidence", async () => {
    const root = await tempRoot();
    await writePackageJson(root, "0.1.0");

    const report = await runPreflight(root, ["--require-ready"]);

    expect(report.status).toBe("PUBLISHED");
    expect(report.registry.status).toBe("VERSION_ALREADY_PUBLISHED");
    expect(report.registry.currentVersionAvailable).toBe(false);
    expect(report.publishedPackage).toBe("https://www.npmjs.com/package/splunkready/v/0.1.0");
    expect(report.releaseCommand).toBe("npm version patch && npm publish --access public");
    expect(report.failures).toEqual([]);
  });

  it("reports a bumped unpublished version as ready to publish", async () => {
    const root = await tempRoot();
    await writePackageJson(root, "0.1.1");

    const report = await runPreflight(root, ["--require-ready"]);

    expect(report.status).toBe("READY");
    expect(report.registry.status).toBe("EXISTS_VERSION_AVAILABLE");
    expect(report.registry.currentVersionAvailable).toBe(true);
    expect(report.publishedPackage).toBeNull();
    expect(report.releaseCommand).toBe("npm publish --access public");
  });
});
