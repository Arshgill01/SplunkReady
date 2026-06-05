import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

export type FixtureCertificationPhase =
  | "compile"
  | "evaluate"
  | "receipt-before"
  | "rerun"
  | "receipt-after"
  | "ui-shell"
  | "demo-rehearsal"
  | "proof-audit";

export interface FixtureCertificationProgress {
  phase: FixtureCertificationPhase;
  status: "started" | "completed" | "failed";
  message: string;
}

export interface FixtureCertificationWorkflowInput {
  outDir: string;
  runId?: string;
  includeProofAudit?: boolean;
  onProgress?(event: FixtureCertificationProgress): void | Promise<void>;
}

export interface FixtureCertificationWorkflowResult {
  status: "PASS";
  runId: string;
  outDir: string;
  artifacts: string[];
  beforeVerdict: string | null;
  afterVerdict: string | null;
  failToPass: boolean | null;
  mutation: boolean | null;
  errors: [];
}

export interface FixtureCertificationWorkflowSteps {
  compile(): Promise<string[]>;
  evaluate(): Promise<string[]>;
  receiptBefore(): Promise<string[]>;
  rerun(): Promise<string[]>;
  receiptAfter(): Promise<string[]>;
  writeUiShell(): Promise<string>;
  proofAudit?(): Promise<string[]>;
}

export class FixtureCertificationWorkflowError extends Error {
  readonly code = "FIXTURE_CERTIFICATION_WORKFLOW_FAILED";
  readonly phase: FixtureCertificationPhase;

  constructor(phase: FixtureCertificationPhase, message: string) {
    super(message);
    this.name = "FixtureCertificationWorkflowError";
    this.phase = phase;
  }
}

interface ReceiptSummary {
  verdict?: unknown;
  score?: unknown;
}

interface ProofAuditSummary {
  failToPass?: unknown;
  mutation?: unknown;
}

const phaseMessages: Record<FixtureCertificationPhase, string> = {
  compile: "Compiled fixture environment contract and policy.",
  evaluate: "Ran before-policy specimen trace and deterministic grading.",
  "receipt-before": "Generated before-policy Readiness Receipt.",
  rerun: "Ran after-policy specimen trace and deterministic grading.",
  "receipt-after": "Generated after-policy Readiness Receipt.",
  "ui-shell": "Wrote certification replay UI shell.",
  "demo-rehearsal": "Wrote demo rehearsal metadata.",
  "proof-audit": "Wrote proof audit and manifest."
};

const secretPatterns = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\b(token|secret|password|api[_-]?key)=\S+/gi
];

const redactWorkflowText = (value: string): string =>
  secretPatterns.reduce((text, pattern) => text.replace(pattern, (match) => {
    const separator = match.includes("=") ? "=" : " ";
    const [label] = match.split(separator);

    return `${label}${separator}[REDACTED]`;
  }), value);

const errorMessage = (error: unknown): string =>
  redactWorkflowText(error instanceof Error ? error.message : String(error));

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const writeText = async (filePath: string, value: string): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, value.endsWith("\n") ? value : `${value}\n`, "utf8");
};

const readOptionalJson = async <T>(filePath: string): Promise<T | undefined> => {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return undefined;
  }
};

const uniqueArtifacts = (artifacts: string[]): string[] => [...new Set(artifacts)];

const runIdFromOutDir = (outDir: string): string => basename(resolve(outDir));

const emitProgress = async (
  input: FixtureCertificationWorkflowInput,
  event: FixtureCertificationProgress
): Promise<void> => {
  await input.onProgress?.(event);
};

const runPhase = async (
  input: FixtureCertificationWorkflowInput,
  phase: FixtureCertificationPhase,
  step: () => Promise<string[]>
): Promise<string[]> => {
  await emitProgress(input, { phase, status: "started", message: phaseMessages[phase] });

  try {
    const artifacts = await step();
    await emitProgress(input, { phase, status: "completed", message: phaseMessages[phase] });
    return artifacts;
  } catch (error) {
    const message = errorMessage(error);
    await emitProgress(input, { phase, status: "failed", message });
    throw new FixtureCertificationWorkflowError(phase, message);
  }
};

const writeDemoRehearsal = async (outDir: string, startedAt: number, expectedArtifacts: string[]): Promise<string[]> => {
  const rehearsalPath = join(outDir, "demo-rehearsal.json");
  const notesPath = join(outDir, "demo-rehearsal.md");
  const elapsedSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(3));
  const uiShellPath = join(outDir, "splunkready-shell.html");
  const uiRoute = `${uiShellPath}#certification-replay`;
  const expectedArtifactsWithRehearsal = uniqueArtifacts([...expectedArtifacts, rehearsalPath, notesPath]);
  const rehearsal = {
    status: "PASS",
    targetSeconds: 180,
    measuredSeconds: elapsedSeconds,
    fitsUnderThreeMinutes: elapsedSeconds < 180,
    uiRoute,
    story: "fail -> compile -> patch -> rerun -> pass",
    expectedArtifacts: expectedArtifactsWithRehearsal,
    timingNotes: [
      { segment: "setup", targetSeconds: 15 },
      { segment: "scary failure", targetSeconds: 30 },
      { segment: "compile and grade", targetSeconds: 70 },
      { segment: "policy patch", targetSeconds: 25 },
      { segment: "rerun and close", targetSeconds: 40 }
    ]
  };

  await writeJson(rehearsalPath, rehearsal);
  await writeText(
    notesPath,
    `# SplunkReady Demo Rehearsal

- Story: fail -> compile -> patch -> rerun -> pass.
- Target: under 180 seconds.
- Measured CLI orchestration: ${elapsedSeconds}s.
- UI route: ${uiRoute}
- Expected artifacts: ${expectedArtifactsWithRehearsal.length}

Open the UI shell at the route above and follow docs/demo-script.md for the spoken path.
`
  );

  return [rehearsalPath, notesPath];
};

export const runFixtureCertification = async (
  input: FixtureCertificationWorkflowInput,
  steps: FixtureCertificationWorkflowSteps
): Promise<FixtureCertificationWorkflowResult> => {
  const startedAt = Date.now();
  const artifacts: string[] = [];

  artifacts.push(...(await runPhase(input, "compile", steps.compile)));
  artifacts.push(...(await runPhase(input, "evaluate", steps.evaluate)));
  artifacts.push(...(await runPhase(input, "receipt-before", steps.receiptBefore)));
  artifacts.push(...(await runPhase(input, "rerun", steps.rerun)));
  artifacts.push(...(await runPhase(input, "receipt-after", steps.receiptAfter)));
  artifacts.push(...(await runPhase(input, "ui-shell", async () => [await steps.writeUiShell()])));
  artifacts.push(
    ...(await runPhase(input, "demo-rehearsal", () => writeDemoRehearsal(input.outDir, startedAt, uniqueArtifacts(artifacts))))
  );

  if (input.includeProofAudit && steps.proofAudit) {
    artifacts.push(...(await runPhase(input, "proof-audit", steps.proofAudit)));
  }

  const beforeReceipt = await readOptionalJson<ReceiptSummary>(join(input.outDir, "receipt-before-001.json"));
  const afterReceipt = await readOptionalJson<ReceiptSummary>(join(input.outDir, "receipt-after-001.json"));
  const proofAudit = await readOptionalJson<ProofAuditSummary>(join(input.outDir, "proof-audit.json"));
  const beforeVerdict = typeof beforeReceipt?.verdict === "string" ? beforeReceipt.verdict : null;
  const afterVerdict = typeof afterReceipt?.verdict === "string" ? afterReceipt.verdict : null;
  const failToPass =
    typeof proofAudit?.failToPass === "boolean"
      ? proofAudit.failToPass
      : beforeVerdict && afterVerdict
        ? beforeVerdict === "NOT READY" && afterVerdict === "READY"
        : null;
  const mutation = typeof proofAudit?.mutation === "boolean" ? proofAudit.mutation : false;

  return {
    status: "PASS",
    runId: input.runId ?? runIdFromOutDir(input.outDir),
    outDir: input.outDir,
    artifacts: uniqueArtifacts(artifacts),
    beforeVerdict,
    afterVerdict,
    failToPass,
    mutation,
    errors: []
  };
};

export const runFixtureCertificationWorkflow = async (
  input: FixtureCertificationWorkflowInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<FixtureCertificationWorkflowResult> => {
  const { runFixtureCertificationFromCli } = await import("../cli.js");

  return runFixtureCertificationFromCli(input, env);
};
