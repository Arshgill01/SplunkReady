import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runSplunkReceiptStoreProofWorkflow } from "../../src/workflows/splunk-receipt-store.js";

const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-receipt-store-test-"));

const writeReceiptChain = async (root: string): Promise<string> => {
  const receiptDir = join(root, "suite-proof");
  const missionDir = join(receiptDir, "mission-security-lateral-movement-readiness");
  await mkdir(missionDir, { recursive: true });
  await writeFile(
    join(missionDir, "receipt-after-001.json"),
    JSON.stringify(
      {
        id: "receipt-after-001",
        verdict: "READY",
        score: 100,
        contractVersion: "2026.06.01",
        receiptHash: "hash-after",
        previousReceiptHash: "hash-before"
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    join(receiptDir, "receipt-chain.json"),
    JSON.stringify(
      {
        source: "splunkready-receipt-chain",
        status: "PASS",
        chainValid: true,
        chainDigest: "digest-001",
        receiptCount: 1,
        entries: [
          {
            sequence: 1,
            path: "mission-security-lateral-movement-readiness/receipt-after-001.json",
            receiptId: "receipt-after-001",
            verdict: "READY",
            score: 100,
            previousReceiptHash: "hash-before",
            receiptHash: "hash-after"
          }
        ]
      },
      null,
      2
    ),
    "utf8"
  );
  return receiptDir;
};

describe("Splunk receipt store proof workflow", () => {
  it("skips without confirmation or live management credentials and does not leak configured secrets", async () => {
    const outDir = await tempRoot();
    const receiptDir = await writeReceiptChain(outDir);

    const result = await runSplunkReceiptStoreProofWorkflow(
      {
        outDir,
        receiptDir,
        confirmWrite: false,
        envFileUsed: true
      },
      {
        SPLUNKREADY_SPLUNK_PASSWORD: "super-secret-password",
        SPLUNKREADY_SPLUNK_USERNAME: "admin"
      }
    );

    expect(result.status).toBe("SKIP");
    expect(result.messages.join(" ")).toContain("missing operator confirmation");

    const proof = await readFile(join(outDir, "splunk-receipt-store-proof.json"), "utf8");
    expect(proof).toContain('"status": "SKIP"');
    expect(proof).toContain('"envFileUsed": true');
    expect(proof).toContain('"usernameConfigured": true');
    expect(proof).toContain('"passwordConfigured": true');
    expect(proof).not.toContain("super-secret-password");
    expect(proof).not.toContain("admin");
  });

  it("writes public-safe receipt summaries and verifies lookup readback", async () => {
    const outDir = await tempRoot();
    const receiptDir = await writeReceiptChain(outDir);
    const requests: Array<{ url: string; method: string; body?: string }> = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({
        url: String(url),
        method: init?.method ?? "GET",
        body: init?.body ? String(init.body) : undefined
      });

      if (String(url).includes("/services/search/jobs/export")) {
        return new Response(`${JSON.stringify({ result: { receipt_hash: "hash-after" } })}\n`, { status: 200 });
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;

    const result = await runSplunkReceiptStoreProofWorkflow(
      {
        outDir,
        receiptDir,
        confirmWrite: true,
        fetch: fetchImpl
      },
      {
        SPLUNKREADY_SPLUNK_MANAGEMENT_URL: "https://splunk.example.test:8089",
        SPLUNKREADY_SPLUNK_USERNAME: "admin",
        SPLUNKREADY_SPLUNK_PASSWORD: "super-secret-password"
      }
    );

    expect(result.status).toBe("PASS");
    expect(requests.map((request) => request.method)).toEqual(["DELETE", "POST", "POST"]);
    expect(requests[0]?.url).toContain("/storage/collections/data/splunkready_receipts/");
    expect(requests[1]?.url).toBe("https://splunk.example.test:8089/servicesNS/nobody/SplunkReady/storage/collections/data/splunkready_receipts?output_mode=json");
    expect(requests[1]?.body).toContain('"receipt_hash":"hash-after"');
    expect(requests[1]?.body).toContain('"policy_id":"default-readiness-policy"');
    expect(new URLSearchParams(requests[2]?.body).get("search")).toContain("| inputlookup splunkready_receipts_lookup");

    const proof = await readFile(join(outDir, "splunk-receipt-store-proof.json"), "utf8");
    expect(proof).toContain('"status": "PASS"');
    expect(proof).toContain('"splunkMutation": "operator-approved-receipt-store-write"');
    expect(proof).toContain('"writtenRows": 1');
    expect(proof).toContain('"hash-after"');
    expect(proof).toContain('"secretValuesWritten": false');
    expect(proof).not.toContain("splunk.example.test");
    expect(proof).not.toContain("super-secret-password");
    expect(proof).not.toContain("admin");
  });
});
