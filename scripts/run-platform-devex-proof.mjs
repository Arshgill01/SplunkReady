import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(new URL("..", import.meta.url).pathname);
const outDir = resolve(root, "artifacts/platform-devex-proof");
const cli = resolve(root, "dist/src/cli.js");

const run = async (label, args) => {
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
const rel = (path) => relative(root, path).split("\\").join("/");

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const fixtureDemoDir = resolve(outDir, "fixture-demo");
const judgeProofDir = resolve(outDir, "judge-proof");
const transcriptDir = resolve(outDir, "mcp-transcript");
const startedAt = new Date().toISOString();

const steps = [
  await run("fixture-demo", ["demo", "--out", rel(fixtureDemoDir)]),
  await run("judge-proof", ["judge-proof", "--out", rel(judgeProofDir), "--json"]),
  await run("mcp-transcript", [
    "certify-mcp-transcript",
    "--transcript",
    "examples/sample-mcp-transcript-pass.jsonl",
    "--out",
    rel(transcriptDir),
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
    fixtureDemo: rel(fixtureDemoDir),
    judgeProof: rel(judgeProofDir),
    mcpTranscript: rel(transcriptDir),
    demoRehearsal: rel(resolve(fixtureDemoDir, "demo-rehearsal.json")),
    fixtureBeforeReceipt: rel(resolve(fixtureDemoDir, "receipt-before-001.json")),
    fixtureAfterReceipt: rel(resolve(fixtureDemoDir, "receipt-after-001.json")),
    judgeProofSummary: rel(resolve(judgeProofDir, "judge-proof-summary.json")),
    transcriptCertification: rel(resolve(transcriptDir, "mcp-transcript-certification.json")),
    transcriptReceipt: rel(resolve(transcriptDir, "receipt-external-001.json"))
  },
  receipts: {
    fixtureBefore: fixtureBeforeReceipt.verdict,
    fixtureAfter: fixtureAfterReceipt.verdict,
    transcript: transcriptReceipt.verdict
  },
  routes: {
    fixtureReplay: `${rel(fixtureDemoDir)}/splunkready-shell.html#certification-replay`,
    transcriptReceipt: `${rel(transcriptDir)}/receipt-external-001.json`
  }
};

await writeFile(resolve(outDir, "platform-devex-proof.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
await writeFile(
  resolve(outDir, "platform-devex-proof.md"),
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

console.log(JSON.stringify(summary, null, 2));
