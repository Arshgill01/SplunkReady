import { execFile } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, "../..");
const scriptPath = resolve(repoRoot, "scripts/audit-hosted-demo-currentness.mjs");
const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-hosted-demo-currentness-test-"));
const servers: Server[] = [];

const writeFixture = async (path: string, value: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
};

const writeLocalDistUi = async (root: string): Promise<void> => {
  await writeFixture(
    join(root, "dist-ui", "index.html"),
    '<!doctype html><script type="module" src="./assets/index-test.js"></script><link rel="stylesheet" href="./assets/index-test.css">'
  );
};

const startHostedDemo = async (manifest: Record<string, unknown>, indexHtml: string): Promise<string> => {
  const server = createServer((request, response) => {
    if (request.url === "/public-demo-manifest.json") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(manifest));
      return;
    }

    response.setHeader("content-type", "text/html");
    response.end(indexHtml);
  });

  await new Promise<void>((resolveServer) => server.listen(0, "127.0.0.1", resolveServer));
  servers.push(server);

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Unexpected hosted demo test server address.");
  }

  return `http://127.0.0.1:${address.port}/`;
};

const runAudit = async (
  root: string,
  url: string,
  expectedCommit: string
): Promise<{ status: string; failures: string[]; assets: { match: boolean }; hostedSourceCommit: string }> => {
  const result = await execFileAsync(process.execPath, [scriptPath, "--url", url, "--expected-commit", expectedCommit], {
    cwd: root,
    env: process.env
  });

  return JSON.parse(result.stdout);
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolveServer) => server.close(() => resolveServer()))));
});

describe("hosted demo currentness audit", () => {
  it("reports current when hosted manifest commit and assets match local public demo inputs", async () => {
    const root = await tempRoot();
    const expectedCommit = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    await writeLocalDistUi(root);
    const url = await startHostedDemo(
      {
        source: "splunkready-public-demo-export",
        sourceCommit: expectedCommit,
        sourceCommitShort: expectedCommit.slice(0, 7),
        mutation: false,
        defaultUrl: "?artifacts=artifacts%2Fmcp-proof#mcp-proof",
        artifactBases: ["artifacts/mcp-proof", "artifacts/suite-proof", "artifacts/public-proof-export", "artifacts/judge-proof"]
      },
      '<!doctype html><script type="module" src="./assets/index-test.js"></script><link rel="stylesheet" href="./assets/index-test.css">'
    );

    await expect(runAudit(root, url, expectedCommit)).resolves.toMatchObject({
      source: "splunkready-hosted-demo-currentness",
      status: "CURRENT",
      hostedSourceCommit: expectedCommit,
      assets: { match: true },
      mutation: false,
      failures: []
    });
  });

  it("reports stale when hosted manifest commit is behind expected public demo inputs", async () => {
    const root = await tempRoot();

    await writeLocalDistUi(root);
    const url = await startHostedDemo(
      {
        source: "splunkready-public-demo-export",
        sourceCommit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        mutation: false,
        defaultUrl: "?artifacts=artifacts%2Fmcp-proof#mcp-proof"
      },
      '<!doctype html><script type="module" src="./assets/index-test.js"></script><link rel="stylesheet" href="./assets/index-test.css">'
    );
    const report = await runAudit(root, url, "cccccccccccccccccccccccccccccccccccccccc");

    expect(report).toMatchObject({
      status: "STALE",
      assets: { match: true }
    });
    expect(report.failures.join("\n")).toContain("does not match expected public-demo input commit");
  });
});
