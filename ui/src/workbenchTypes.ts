import type { ProofManifestVerification } from "./artifacts.js";

export interface WorkbenchRenderState {
  available: boolean;
  healthStatus?: string;
  liveAvailable?: boolean;
  liveMissing?: string[];
  saiaAvailable?: boolean;
  runFilter?: string;
  runStatusFilter?: string;
  runWorkflowFilter?: string;
  runs?: WorkbenchRunSummary[];
  manifestVerification?: ManifestVerificationState;
  job?: {
    id: string;
    workflow?: string;
    state: string;
    runId: string;
    artifactBase: string;
    inputSummary?: string;
    error?: string;
    events: Array<{ id: number; type: string; message: string; artifact?: string }>;
  };
}

export interface WorkbenchRunSummary {
  runId: string;
  artifactBase: string;
  fileCount: number;
  files: string[];
  workflow: string;
  state: string;
  verdict: string;
  score: number | null;
  violations: number;
  evidenceRefs: number;
  proofAuditStatus: string;
  manifestStatus: string;
  missionIds: string[];
  ruleIds: string[];
  createdAt: string;
}

export interface ManifestVerificationState {
  runId: string;
  status: "PASS" | "FAIL" | "ERROR";
  message?: string;
  report?: ProofManifestVerification;
}
