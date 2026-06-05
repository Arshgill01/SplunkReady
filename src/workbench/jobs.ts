import { relative } from "node:path";

import { runFixtureCertificationWorkflow } from "../cli.js";
import { WorkbenchArtifactStore } from "./artifacts.js";
import { redactUnknownError } from "./redaction.js";
import type { WorkbenchConfig } from "./config.js";
import type { WorkbenchEvent, WorkbenchJobSnapshot, WorkbenchWorkflow } from "./events.js";

export type WorkbenchWorkflowHandler = (input: { outDir: string }) => Promise<{ artifacts: string[] }>;

export interface WorkbenchJobRunnerOptions {
  config: WorkbenchConfig;
  artifactStore: WorkbenchArtifactStore;
  workflows?: Partial<Record<WorkbenchWorkflow, WorkbenchWorkflowHandler>>;
}

const now = (): string => new Date().toISOString();

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
      ...options.workflows
    };
  }

  listJobs(): WorkbenchJobSnapshot[] {
    return [...this.jobs.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  getJob(id: string): WorkbenchJobSnapshot | undefined {
    return this.jobs.get(id);
  }

  async createJob(workflow: WorkbenchWorkflow): Promise<WorkbenchJobSnapshot> {
    const handler = this.workflows[workflow];

    if (!handler) {
      throw new Error(`Unsupported workbench workflow ${workflow}.`);
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
      artifacts: [],
      events: []
    };

    this.jobs.set(job.id, job);
    this.addEvent(job, "phase", "Queued fixture certification.");
    void this.runJob(job, handler, run.path);

    return this.snapshot(job);
  }

  private async runJob(job: WorkbenchJobSnapshot, handler: WorkbenchWorkflowHandler, outDir: string): Promise<void> {
    job.state = "running";
    job.startedAt = now();
    this.addEvent(job, "phase", "Running Agent Readiness Compiler fixture certification.");

    try {
      const result = await handler({ outDir });
      job.artifacts = result.artifacts.map((artifact) => relative(outDir, artifact).replaceAll("\\", "/"));
      for (const artifact of job.artifacts) {
        this.addEvent(job, "artifact", `Wrote ${artifact}.`, artifact);
      }

      job.state = "succeeded";
      job.completedAt = now();
      this.addEvent(job, "complete", "Fixture certification completed.");
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
