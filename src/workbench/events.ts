export type WorkbenchWorkflow =
  | "fixture-certification"
  | "live-smoke"
  | "live-candidates"
  | "live-security-readiness"
  | "live-security-proof";

export type WorkbenchJobState = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type WorkbenchEventType = "phase" | "artifact" | "warning" | "error" | "complete";

export interface WorkbenchEvent {
  id: number;
  type: WorkbenchEventType;
  message: string;
  at: string;
  artifact?: string;
}

export interface WorkbenchJobSnapshot {
  id: string;
  workflow: WorkbenchWorkflow;
  state: WorkbenchJobState;
  runId: string;
  artifactBase: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  artifacts: string[];
  events: WorkbenchEvent[];
}
