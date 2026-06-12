import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const defaultRoot = resolve(new URL("..", import.meta.url).pathname);

const run = async (root, cli, label, args) => {
  const startedAt = Date.now();
  const { stdout, stderr } = await execFileAsync(process.execPath, [cli, ...args], {
    cwd: root,
    env: {
      ...process.env,
      NO_COLOR: "1",
      SPLUNKREADY_LLM_ENABLED: "false"
    },
    maxBuffer: 20 * 1024 * 1024
  });

  return {
    label,
    command: `splunkready ${args.join(" ")}`,
    durationMs: Date.now() - startedAt,
    stdout: stdout.trim(),
    stderr: stderr.trim()
  };
};

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

export const runPlatformDevexProof = async ({
  root = defaultRoot,
  outDir = resolve(root, "artifacts/platform-devex-proof")
} = {}) => {
  const repoRoot = resolve(root);
  const targetDir = resolve(outDir);
  const cli = resolve(repoRoot, "dist/src/cli.js");
  const relPath = (path) => relative(repoRoot, path).split("\\").join("/");

  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });

  const fixtureDemoDir = resolve(targetDir, "fixture-demo");
  const judgeProofDir = resolve(targetDir, "judge-proof");
  const transcriptDir = resolve(targetDir, "mcp-transcript");
  const startedAt = new Date().toISOString();

  const steps = [
    await run(repoRoot, cli, "fixture-demo", ["demo", "--out", relPath(fixtureDemoDir)]),
    await run(repoRoot, cli, "judge-proof", ["judge-proof", "--out", relPath(judgeProofDir), "--json"]),
    await run(repoRoot, cli, "mcp-transcript", [
      "certify-mcp-transcript",
      "--transcript",
      "examples/sample-mcp-transcript-pass.jsonl",
      "--out",
      relPath(transcriptDir),
      "--strict-import",
      "true",
      "--require-pass",
      "true",
      "--json"
    ])
  ];

  const demoRehearsal = await readJson(resolve(fixtureDemoDir, "demo-rehearsal.json"));
  const fixtureBeforeReceipt = await readJson(resolve(fixtureDemoDir, "receipt-before-001.json"));
  const fixtureAfterReceipt = await readJson(resolve(fixtureDemoDir, "receipt-after-001.json"));
  const judgeProof = await readJson(resolve(judgeProofDir, "judge-proof-summary.json"));
  const transcriptProof = await readJson(resolve(transcriptDir, "mcp-transcript-certification.json"));
  const transcriptReceipt = await readJson(resolve(transcriptDir, "receipt-external-001.json"));

  const summary = {
    source: "splunkready-platform-devex-proof",
    generatedAt: new Date().toISOString(),
    startedAt,
    status:
      demoRehearsal.status === "PASS" && judgeProof.status === "PASS" && transcriptProof.status === "PASS"
        ? "PASS"
        : "FAIL",
    mutation: Boolean(demoRehearsal.mutation || judgeProof.mutation || transcriptProof.mutation),
    deterministicAuthority: true,
    steps: steps.map((step) => ({
      label: step.label,
      command: step.command,
      durationMs: step.durationMs
    })),
    artifacts: {
      fixtureDemo: relPath(fixtureDemoDir),
      judgeProof: relPath(judgeProofDir),
      mcpTranscript: relPath(transcriptDir),
      demoRehearsal: relPath(resolve(fixtureDemoDir, "demo-rehearsal.json")),
      fixtureBeforeReceipt: relPath(resolve(fixtureDemoDir, "receipt-before-001.json")),
      fixtureAfterReceipt: relPath(resolve(fixtureDemoDir, "receipt-after-001.json")),
      judgeProofSummary: relPath(resolve(judgeProofDir, "judge-proof-summary.json")),
      transcriptCertification: relPath(resolve(transcriptDir, "mcp-transcript-certification.json")),
      transcriptReceipt: relPath(resolve(transcriptDir, "receipt-external-001.json"))
    },
    receipts: {
      fixtureBefore: fixtureBeforeReceipt.verdict,
      fixtureAfter: fixtureAfterReceipt.verdict,
      transcript: transcriptReceipt.verdict
    },
    routes: {
      fixtureReplay: `${relPath(fixtureDemoDir)}/splunkready-shell.html#certification-replay`,
      transcriptReceipt: `${relPath(transcriptDir)}/receipt-external-001.json`
    }
  };

  await writeFile(resolve(targetDir, "platform-devex-proof.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(
    resolve(targetDir, "platform-devex-proof.md"),
    `# SplunkReady Platform DevEx Proof

Status: ${summary.status}

Mutation: ${summary.mutation ? "true" : "false"}

Deterministic authority: ${summary.deterministicAuthority ? "true" : "false"}

## Steps

${summary.steps.map((step) => `- ${step.label}: \`${step.command}\` (${step.durationMs} ms)`).join("\n")}

## Evidence

- Fixture demo: \`${summary.artifacts.fixtureDemo}\`
- Judge proof: \`${summary.artifacts.judgeProofSummary}\`
- MCP transcript certification: \`${summary.artifacts.transcriptCertification}\`
- MCP transcript receipt: \`${summary.artifacts.transcriptReceipt}\`

## Routes

- Fixture replay: \`${summary.routes.fixtureReplay}\`
- Transcript receipt: \`${summary.routes.transcriptReceipt}\`
`,
    "utf8"
  );

  if (summary.status !== "PASS" || summary.mutation) {
    throw new Error(`Platform DevEx proof failed: status=${summary.status} mutation=${summary.mutation}`);
  }

  return summary;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const summary = await runPlatformDevexProof();
  console.log(JSON.stringify(summary, null, 2));
}
