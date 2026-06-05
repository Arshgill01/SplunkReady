export type WorkbenchWorkflow =
  | "fixture-certification"
  | "external-trace-certification"
  | "mcp-transcript-certification"
  | "policy-backed-rerun"
  | "firewall-check"
  | "live-smoke"
  | "live-candidates"
  | "live-security-readiness"
  | "live-security-proof"
  | "hosted-model-diagnostic"
  | "hosted-model-proof";

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
  inputSummary?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  artifacts: string[];
  events: WorkbenchEvent[];
}
