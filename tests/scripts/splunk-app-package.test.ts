import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { buildSplunkAppPackage } from "../../scripts/build-splunk-app-package.mjs";

const execFileAsync = promisify(execFile);

const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-splunk-app-package-test-"));

const writeFixture = async (path: string, value: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
};

const createSourceTree = async (): Promise<string> => {
  const root = await tempRoot();

  await writeFixture(join(root, "package.json"), JSON.stringify({ name: "splunkready", version: "0.1.3" }, null, 2));
  await writeFixture(join(root, "artifacts", "public-demo", "index.html"), "<!doctype html><div id=\"app\"></div>");
  await writeFixture(join(root, "artifacts", "public-demo", "assets", "index.js"), "window.__splunkready = true;");
  await writeFixture(
    join(root, "artifacts", "public-demo", "public-demo-manifest.json"),
    JSON.stringify({ source: "splunkready-public-demo-export", mutation: false }, null, 2)
  );

  return root;
};

describe("Splunk app package builder", () => {
  it("packages the public artifact workbench as a Splunk app archive", async () => {
    const root = await createSourceTree();
    const manifest = await buildSplunkAppPackage({
      root,
      outDir: "submission-evidence/splunk-app-package",
      generatedAt: "2026-06-08T00:00:00.000Z"
    });

    expect(manifest).toMatchObject({
      source: "splunkready-splunk-app-package",
      status: "PASS",
      appId: "SplunkReady",
      version: "0.1.3",
      mutation: false,
      packagePath: "submission-evidence/splunk-app-package/SplunkReady-0.1.3.spl",
      staticSource: "artifacts/public-demo",
      staticEntry: "SplunkReady/appserver/static/splunkready/index.html",
      noCredentialFiles: true,
      noPythonHandlers: true,
      noScriptedInputs: true
    });
    expect(manifest.files).toEqual(
      expect.arrayContaining([
        "default/app.conf",
        "default/data/ui/nav/default.xml",
        "default/data/ui/views/splunkready.xml",
        "metadata/default.meta",
        "README.md",
        "appserver/static/splunkready/index.html",
        "appserver/static/splunkready/public-demo-manifest.json",
        "appserver/static/splunkready/assets/index.js"
      ])
    );

    const { stdout } = await execFileAsync("tar", ["-tzf", join(root, manifest.packagePath)]);
    expect(stdout).toContain("SplunkReady/default/app.conf");
    expect(stdout).toContain("SplunkReady/default/data/ui/views/splunkready.xml");
    expect(stdout).toContain("SplunkReady/appserver/static/splunkready/index.html");
    expect(stdout).not.toContain("SplunkReady/local/");
    expect(stdout).not.toContain(".splunkready");

    await mkdir(join(root, "extracted"), { recursive: true });
    await execFileAsync("tar", ["-xzf", join(root, manifest.packagePath), "-C", join(root, "extracted")]);
    await expect(readFile(join(root, "extracted", "SplunkReady", "default", "app.conf"), "utf8")).resolves.toContain(
      "id = SplunkReady"
    );
    await expect(
      readFile(join(root, "extracted", "SplunkReady", "default", "data", "ui", "views", "splunkready.xml"), "utf8")
    ).resolves.toContain("/static/app/SplunkReady/splunkready/index.html");
  });

  it("refuses to package symbolic links from the static source", async () => {
    const root = await createSourceTree();

    await symlink(join(root, "outside-secret.txt"), join(root, "artifacts", "public-demo", "linked-secret.txt"));

    await expect(buildSplunkAppPackage({ root })).rejects.toThrow("Refusing to copy symbolic link into Splunk app package");
  });
});
