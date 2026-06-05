import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { exportPublicDemo } from "../../scripts/export-public-demo.js";

const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-public-demo-test-"));

const writeFixture = async (path: string, value: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
};

const createSourceTree = async (): Promise<string> => {
  const root = await tempRoot();

  await writeFixture(join(root, "dist-ui", "index.html"), "<!doctype html><div id=\"app\"></div>");
  await writeFixture(join(root, "dist-ui", "assets", "index.js"), "window.__splunkready = true;");
  await writeFixture(join(root, "submission-evidence", "mcp-proof", "mcp-proof-summary.json"), "{\"status\":\"PASS\"}\n");
  await writeFixture(join(root, "submission-evidence", "suite-proof", "suite-proof-summary.json"), "{\"status\":\"PASS\"}\n");
  await writeFixture(
    join(root, "submission-evidence", "public-proof-export", "public-proof-summary.json"),
    "{\"status\":\"REDACTED\"}\n"
  );
  await writeFixture(join(root, "submission-evidence", "screenshots", "workbench-mcp-proof.png"), "png-bytes");

  return root;
};

describe("public demo export", () => {
  it("copies the built UI and credential-free proof evidence into one static folder", async () => {
    const root = await createSourceTree();
    const result = await exportPublicDemo({
      root,
      outDir: "out/public-demo",
      generatedAt: "2026-06-06T00:00:00.000Z"
    });

    await expect(readFile(join(root, "out/public-demo/index.html"), "utf8")).resolves.toContain("app");
    await expect(readFile(join(root, "out/public-demo/assets/index.js"), "utf8")).resolves.toContain("splunkready");
    await expect(readFile(join(root, "out/public-demo/artifacts/mcp-proof/mcp-proof-summary.json"), "utf8")).resolves.toContain(
      "PASS"
    );
    await expect(readFile(join(root, "out/public-demo/screenshots/workbench-mcp-proof.png"), "utf8")).resolves.toBe("png-bytes");
    await expect(readFile(join(root, "out/public-demo/public-demo-manifest.json"), "utf8")).resolves.toContain(
      "?artifacts=artifacts%2Fmcp-proof#mcp-proof"
    );
    expect(result.copiedArtifactBases).toEqual(["artifacts/mcp-proof", "artifacts/suite-proof", "artifacts/public-proof-export"]);
    expect(result.manifest.mutation).toBe(false);
  });

  it("refuses to copy symbolic links into the public demo export", async () => {
    const root = await createSourceTree();

    await symlink(
      join(root, "outside-secret.txt"),
      join(root, "submission-evidence", "mcp-proof", "linked-secret.txt")
    );

    await expect(exportPublicDemo({ root, outDir: "out/public-demo" })).rejects.toThrow(
      "Refusing to copy symbolic link into public demo export"
    );
  });
});
