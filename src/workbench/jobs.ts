import { relative } from "node:path";

import { runCertificationIndexWorkflow } from "../workflows/certification-index.js";
import {
  externalCertificationInputSummary,
  runExternalTraceCertificationWorkflow,
  runMcpTranscriptCertificationWorkflow,
  type ExternalCertificationPayload
} from "../workflows/external-certification.js";
import { runFixtureCertificationWorkflow } from "../workflows/fixture-certification.js";
import { runHostedModelDiagnosticWorkflow, runHostedModelProofWorkflow } from "../workflows/hosted-model-actions.js";
import {
  runLiveCandidatesWorkflow,
  runLiveSecurityKitWorkflow,
  runLiveSecurityProofWorkflow,
  runLiveSecurityReadinessWorkflow,
  runLiveSmokeWorkflow
} from "../workflows/live-actions.js";
import { runFirewallCheckWorkflow, runPolicyBackedRerunWorkflow } from "../workflows/policy-actions.js";
import { WorkbenchArtifactStore } from "./artifacts.js";
import { redactUnknownError } from "./redaction.js";
import type { WorkbenchConfig } from "./config.js";
import type { WorkbenchEvent, WorkbenchJobSnapshot, WorkbenchWorkflow } from "./events.js";

export interface WorkbenchWorkflowInput {
  outDir: string;
  artifactBase: string;
  payload?: WorkbenchWorkflowPayload;
}

export type WorkbenchWorkflowHandler = (input: WorkbenchWorkflowInput) => Promise<{ artifacts: string[] }>;

export interface CertificationIndexPayload {
  kind: "certification-index";
  value: {
    runIds: string[];
  };
}

export type WorkbenchWorkflowPayload = ExternalCertificationPayload | CertificationIndexPayload;

export interface WorkbenchJobRunnerOptions {
  config: WorkbenchConfig;
  artifactStore: WorkbenchArtifactStore;
  workflows?: Partial<Record<WorkbenchWorkflow, WorkbenchWorkflowHandler>>;
}

const now = (): string => new Date().toISOString();

const liveWorkflows = new Set<WorkbenchWorkflow>([
  "live-smoke",
  "live-candidates",
  "live-security-readiness",
  "live-security-proof",
  "hosted-model-diagnostic",
  "hosted-model-proof"
]);

const workflowLabel = (workflow: WorkbenchWorkflow): string => {
  if (workflow === "fixture-certification") {
    return "fixture certification";
  }

  if (workflow === "live-security-readiness") {
    return "live security readiness";
  }

  if (workflow === "live-security-kit") {
    return "live security kit";
  }

  if (workflow === "certification-index") {
    return "certification index";
  }

  if (workflow === "live-security-proof") {
    return "live security proof";
  }

  if (workflow === "hosted-model-diagnostic") {
    return "hosted model diagnostic";
  }

  if (workflow === "hosted-model-proof") {
    return "hosted model proof";
  }

  return workflow.replaceAll("-", " ");
};

const inputSummaryForPayload = (payload: WorkbenchWorkflowPayload | undefined): string | undefined => {
  if (!payload) {
    return undefined;
  }

  if (payload.kind === "certification-index") {
    return `${payload.value.runIds.length} managed proof run(s)`;
  }

  return externalCertificationInputSummary(payload);
};

export class WorkbenchJobRunner {
  private readonly config: WorkbenchConfig;
  private readonly artifactStore: WorkbenchArtifactStore;
  private readonly workflows: Record<WorkbenchWorkflow, WorkbenchWorkflowHandler>;
  private readonly jobs = new Map<string, WorkbenchJobSnapshot>();
  private sequence = 0;

  constructor(options: WorkbenchJobRunnerOptions) {
    this.config = options.config;
    this.artifactStore = options.artifactStore;
    this.workflows = {
      "fixture-certification": async ({ outDir }) => runFixtureCertificationWorkflow({ outDir }),
      "external-trace-certification": async ({ outDir, payload }) => {
        if (payload?.kind !== "external-trace") {
          throw new Error("External trace certification requires an external trace upload payload.");
        }

        return runExternalTraceCertificationWorkflow({ outDir, payload: payload.value });
      },
      "policy-backed-rerun": async ({ outDir }) => runPolicyBackedRerunWorkflow({ outDir }),
      "firewall-check": async ({ outDir }) => runFirewallCheckWorkflow({ outDir }),
      "mcp-transcript-certification": async ({ outDir, payload }) => {
        if (payload?.kind !== "mcp-transcript") {
          throw new Error("MCP transcript certification requires an MCP transcript upload payload.");
        }

        return runMcpTranscriptCertificationWorkflow({ outDir, payload: payload.value });
      },
      "certification-index": async ({ outDir, artifactBase, payload }) => {
        if (payload?.kind !== "certification-index") {
          throw new Error("Certification index requires selected managed proof runs.");
        }

        return runCertificationIndexWorkflow({
          outDir,
          proofDirs: payload.value.runIds.map((runId) => this.artifactStore.resolveRun(runId)),
          proofArtifactBases: payload.value.runIds.map((runId) => `/api/artifacts/${runId}`),
          indexArtifactBase: artifactBase
        });
      },
      "live-smoke": async ({ outDir }) => runLiveSmokeWorkflow({ outDir }),
      "live-candidates": async ({ outDir }) => runLiveCandidatesWorkflow({ outDir }),
      "live-security-kit": async ({ outDir }) => runLiveSecurityKitWorkflow({ outDir }),
      "live-security-readiness": async ({ outDir }) => runLiveSecurityReadinessWorkflow({ outDir }),
      "live-security-proof": async ({ outDir }) => runLiveSecurityProofWorkflow({ outDir }),
      "hosted-model-diagnostic": async ({ outDir }) => runHostedModelDiagnosticWorkflow({ outDir }),
      "hosted-model-proof": async ({ outDir }) => runHostedModelProofWorkflow({ outDir }),
      ...options.workflows
    };
  }

  listJobs(): WorkbenchJobSnapshot[] {
    return [...this.jobs.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  getJob(id: string): WorkbenchJobSnapshot | undefined {
    return this.jobs.get(id);
  }

  async createJob(workflow: WorkbenchWorkflow, payload?: WorkbenchWorkflowPayload): Promise<WorkbenchJobSnapshot> {
    const handler = this.workflows[workflow];

    if (!handler) {
      throw new Error(`Unsupported workbench workflow ${workflow}.`);
    }

    if (liveWorkflows.has(workflow) && !this.config.liveAvailable) {
      throw new Error(`Live mode unavailable. Missing server env: ${this.config.liveMissing.join(", ")}.`);
    }

    const activeJobs = this.listJobs().filter((job) => job.state === "queued" || job.state === "running");

    if (activeJobs.length >= this.config.maxConcurrentJobs) {
      throw new Error("Workbench job limit reached.");
    }

    const run = await this.artifactStore.createRunDirectory();
    const job: WorkbenchJobSnapshot = {
      id: `job-${++this.sequence}`,
      workflow,
      state: "queued",
      runId: run.runId,
      artifactBase: `/api/artifacts/${run.runId}`,
      createdAt: now(),
      inputSummary: inputSummaryForPayload(payload),
      artifacts: [],
      events: []
    };

    this.jobs.set(job.id, job);
    this.addEvent(job, "phase", `Queued ${workflowLabel(workflow)}.`);
    void this.runJob(job, handler, run.path, payload);

    return this.snapshot(job);
  }

  private async runJob(
    job: WorkbenchJobSnapshot,
    handler: WorkbenchWorkflowHandler,
    outDir: string,
    payload?: WorkbenchWorkflowPayload
  ): Promise<void> {
    job.state = "running";
    job.startedAt = now();
    this.addEvent(job, "phase", `Running Agent Readiness Compiler ${workflowLabel(job.workflow)}.`);

    try {
      const result = await handler({ outDir, artifactBase: job.artifactBase, payload });
      job.artifacts = result.artifacts.map((artifact) => relative(outDir, artifact).replaceAll("\\", "/"));
      for (const artifact of job.artifacts) {
        this.addEvent(job, "artifact", `Wrote ${artifact}.`, artifact);
      }

      job.state = "succeeded";
      job.completedAt = now();
      this.addEvent(job, "complete", `${workflowLabel(job.workflow)} completed.`);
    } catch (error) {
      job.state = "failed";
      job.completedAt = now();
      job.error = redactUnknownError(error);
      this.addEvent(job, "error", job.error);
    }
  }

  private addEvent(job: WorkbenchJobSnapshot, type: WorkbenchEvent["type"], message: string, artifact?: string): void {
    job.events.push({ id: job.events.length + 1, type, message, artifact, at: now() });
  }

  private snapshot(job: WorkbenchJobSnapshot): WorkbenchJobSnapshot {
    return {
      ...job,
      artifacts: [...job.artifacts],
      events: job.events.map((event) => ({ ...event }))
    };
  }
}
