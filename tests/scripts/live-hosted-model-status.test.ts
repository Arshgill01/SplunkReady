import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, "../..");
const scriptPath = resolve(repoRoot, "scripts/audit-live-hosted-model-status.mjs");

const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-live-hosted-model-status-test-"));

const writeFixture = async (path: string, value: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
};

const diagnosticFixture = (overrides: Record<string, unknown> = {}): string =>
  `${JSON.stringify(
    {
      status: "BLOCKED",
      mode: "live",
      mutation: false,
      blockerClass: "SAIA_REST_HANDLERS_NOT_REGISTERED",
      requiredTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
      availableTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
      passedTools: [],
      blockedTools: ["saia_generate_spl", "saia_explain_spl", "saia_optimize_spl", "saia_ask_splunk_question"],
      restHandlerProbe: { status: "NOT_REGISTERED" },
      remediation: {
        summary:
          "The MCP contract advertises hosted-model tools, but Splunk AI Assistant's splunkd REST handlers are not registered for the SAIA routes.",
        operatorChecks: ["Restart splunkd."]
      },
      permission: {
        status: "BLOCKED",
        blockerClass: "SAIA_REST_HANDLERS_NOT_REGISTERED",
        message: "Splunk AI Assistant REST handlers are not registered."
      },
      deterministicAuthority: "deterministic-rule-engine",
      ...overrides
    },
    null,
    2
  )}\n`;

describe("live hosted-model status audit", () => {
  it("tracks the read-only SAIA readiness probe without secrets", async () => {
    const readinessPath = join(
      repoRoot,
      "submission-evidence/live-hosted-model-status/live-saia-readiness-probe.json"
    );
    const readiness = JSON.parse(await readFile(readinessPath, "utf8")) as {
      source: string;
      status: string;
      probes: Array<{ id: string; status: string }>;
      redaction: { status: string; secretsWritten: boolean; tenantIdentifiersWritten: boolean };
      mutation: boolean;
    };

    expect(readiness).toMatchObject({
      source: "splunkready-live-saia-readiness-probe",
      status: "ACTION_REQUIRED",
      redaction: { status: "PASS", secretsWritten: false, tenantIdentifiersWritten: false },
      mutation: false
    });
    expect(readiness.probes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "saia-token-handler", status: "PASS" }),
        expect.objectContaining({ id: "cloud-connected-config", status: "PASS" }),
        expect.objectContaining({ id: "mcp-tool-enabled", status: "ACTION_REQUIRED" }),
        expect.objectContaining({ id: "agent-mode-v2-enabled", status: "ACTION_REQUIRED" })
      ])
    );
  });

  it("exports a secret-safe public status summary", async () => {
    const root = await tempRoot();
    const artifactPath = join(root, "artifacts/live-hosted-model-diagnostic/hosted-model-diagnostic.json");
    const envFilePath = join(root, ".splunkready-live.env");
    const outPath = join(root, "submission-evidence/live-hosted-model-status/live-hosted-model-status.json");

    await writeFixture(artifactPath, diagnosticFixture());
    await writeFixture(
      envFilePath,
      [
        "SPLUNKREADY_LIVE_ENABLED=true",
        "SPLUNKREADY_SPLUNK_MCP_URL=https://localhost:8089/services/mcp",
        "SPLUNKREADY_SPLUNK_MCP_TOKEN=test-token-for-redaction"
      ].join("\n")
    );

    const result = await execFileAsync(process.execPath, [
      scriptPath,
      "--artifact",
      artifactPath,
      "--env-file",
      envFilePath,
      "--out",
      outPath,
      "--require-blocked",
      "--expect-blocker",
      "SAIA_REST_HANDLERS_NOT_REGISTERED"
    ]);
    const stdout = JSON.parse(result.stdout) as {
      status: string;
      blockerClass: string;
      restHandlerProbeStatus: string;
      rawArtifactTracked: boolean;
      redactionAudit: { status: string; leakedSecretNames: string[] };
    };
    const written = JSON.parse(await readFile(outPath, "utf8")) as typeof stdout;

    expect(stdout).toMatchObject({
      status: "BLOCKED",
      blockerClass: "SAIA_REST_HANDLERS_NOT_REGISTERED",
      restHandlerProbeStatus: "NOT_REGISTERED",
      rawArtifactTracked: false,
      redactionAudit: { status: "PASS", leakedSecretNames: [] }
    });
    expect(written).toEqual(stdout);
  });

  it("fails if the ignored live artifact contains the operator token value", async () => {
    const root = await tempRoot();
    const artifactPath = join(root, "artifacts/live-hosted-model-diagnostic/hosted-model-diagnostic.json");
    const envFilePath = join(root, ".splunkready-live.env");

    await writeFixture(artifactPath, diagnosticFixture({ error: "Bearer test-token-for-redaction" }));
    await writeFixture(envFilePath, "SPLUNKREADY_SPLUNK_MCP_TOKEN=test-token-for-redaction\n");

    await expect(
      execFileAsync(process.execPath, [scriptPath, "--artifact", artifactPath, "--env-file", envFilePath])
    ).rejects.toMatchObject({ code: 1 });
  });

  it("fails if the ignored live artifact contains the operator endpoint value", async () => {
    const root = await tempRoot();
    const artifactPath = join(root, "artifacts/live-hosted-model-diagnostic/hosted-model-diagnostic.json");
    const envFilePath = join(root, ".splunkready-live.env");

    await writeFixture(artifactPath, diagnosticFixture({ error: "fetch failed at https://localhost:8089/services/mcp" }));
    await writeFixture(envFilePath, "SPLUNKREADY_SPLUNK_MCP_URL=https://localhost:8089/services/mcp\n");

    await expect(
      execFileAsync(process.execPath, [scriptPath, "--artifact", artifactPath, "--env-file", envFilePath])
    ).rejects.toMatchObject({ code: 1 });
  });
});
