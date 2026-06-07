import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runSplunkAppInstallProofWorkflow } from "../../src/workflows/splunk-app-install.js";

const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-app-install-test-"));

describe("Splunk app install proof workflow", () => {
  it("skips without confirmation or live management credentials and does not leak configured secrets", async () => {
    const outDir = await tempRoot();
    const packagePath = join(outDir, "SplunkReady-0.1.3.spl");
    await writeFile(packagePath, "fake-spl", "utf8");

    const result = await runSplunkAppInstallProofWorkflow(
      {
        outDir,
        appPackagePath: "submission-evidence/splunk-app-package/SplunkReady-0.1.3.spl",
        confirmInstall: false,
        envFileUsed: true
      },
      {
        SPLUNKREADY_SPLUNK_PASSWORD: "super-secret-password",
        SPLUNKREADY_SPLUNK_USERNAME: "admin"
      }
    );

    expect(result.status).toBe("SKIP");
    expect(result.messages.join(" ")).toContain("missing operator confirmation");

    const proof = await readFile(join(outDir, "splunk-app-install-proof.json"), "utf8");
    expect(proof).toContain('"status": "SKIP"');
    expect(proof).toContain('"envFileUsed": true');
    expect(proof).toContain('"usernameConfigured": true');
    expect(proof).toContain('"passwordConfigured": true');
    expect(proof).not.toContain("super-secret-password");
    expect(proof).not.toContain("admin");
  });

  it("installs and probes the Splunk app through redacted operator-approved requests", async () => {
    const outDir = await tempRoot();
    const packagePath = join(outDir, "SplunkReady-0.1.3.spl");
    await writeFile(packagePath, "fake-spl", "utf8");
    const requests: Array<{ url: string; method: string; body?: string }> = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({
        url: String(url),
        method: init?.method ?? "GET",
        body: init?.body ? String(init.body) : undefined
      });
      return new Response(JSON.stringify({ entry: [] }), { status: 200 });
    }) as typeof fetch;

    const result = await runSplunkAppInstallProofWorkflow(
      {
        outDir,
        appPackagePath: packagePath,
        confirmInstall: true,
        fetch: fetchImpl
      },
      {
        SPLUNKREADY_SPLUNK_MANAGEMENT_URL: "https://splunk.example.test:8089",
        SPLUNKREADY_SPLUNK_USERNAME: "admin",
        SPLUNKREADY_SPLUNK_PASSWORD: "super-secret-password"
      }
    );

    expect(result.status).toBe("PASS");
    expect(requests.map((request) => request.method)).toEqual(["POST", "GET", "GET", "GET", "GET", "GET", "GET"]);
    expect(requests[0]?.url).toBe("https://splunk.example.test:8089/services/apps/local");
    expect(requests[0]?.body).toContain("filename=true");
    expect(requests[0]?.body).toContain("update=true");

    const proof = await readFile(join(outDir, "splunk-app-install-proof.json"), "utf8");
    expect(proof).toContain('"status": "PASS"');
    expect(proof).toContain('"splunkMutation": "operator-approved-app-install"');
    expect(proof).toContain('"secretValuesWritten": false');
    expect(proof).not.toContain("splunk.example.test");
    expect(proof).not.toContain("super-secret-password");
    expect(proof).not.toContain("admin");
    expect(proof).toContain('"receipt-collection"');
    expect(proof).toContain('"receipt-lookup"');
  });
});

