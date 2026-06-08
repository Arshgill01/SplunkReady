import type { LlmAgentAnswer, LlmAgentClaimEvidence, LlmAgentObservation } from "./llm-specimen.js";

export type LlmClaimAuditStatus = "PASS" | "WARN" | "FAIL";
export type LlmClaimAuditSupport = "supported" | "partial" | "unsupported";

export interface LlmClaimAuditRow {
  claim: string;
  declaredSupport: LlmAgentClaimEvidence["support"];
  auditedSupport: LlmClaimAuditSupport;
  matchedQueryRefs: string[];
  missingQueryRefs: string[];
  matchedEvidenceRefs: string[];
  missingEvidenceRefs: string[];
  limitation?: string;
  findings: string[];
}

export interface LlmClaimAuditReport {
  source: "splunkready-llm-claim-audit";
  contractVersion: "llm-claim-audit-v1";
  advisoryOnly: true;
  passFailAuthority: "deterministic-rule-engine";
  status: LlmClaimAuditStatus;
  totalClaims: number;
  supportedClaims: number;
  partialClaims: number;
  unsupportedClaims: number;
  hallucinatedRefs: string[];
  observedRefs: {
    toolNames: string[];
    queryRefs: string[];
    evidenceRefs: string[];
  };
  claims: LlmClaimAuditRow[];
}

const normalize = (value: string): string => value.trim().toLowerCase();

const unique = (values: string[]): string[] => [...new Set(values.filter(Boolean))].sort();

const observedReferenceSet = (observations: LlmAgentObservation[]): Set<string> =>
  new Set(
    observations
      .flatMap((observation) => [
        observation.toolName,
        observation.queryRef ?? "",
        ...observation.evidenceRefs
      ])
      .filter(Boolean)
      .map(normalize)
  );

const observedRefsFrom = (observations: LlmAgentObservation[]): LlmClaimAuditReport["observedRefs"] => ({
  toolNames: unique(observations.map((observation) => observation.toolName)),
  queryRefs: unique(observations.map((observation) => observation.queryRef ?? "")),
  evidenceRefs: unique(observations.flatMap((observation) => observation.evidenceRefs))
});

const splitRefs = (refs: string[] | undefined, observedRefs: Set<string>): { matched: string[]; missing: string[] } => {
  const values = unique(refs ?? []);

  return {
    matched: values.filter((ref) => observedRefs.has(normalize(ref))),
    missing: values.filter((ref) => !observedRefs.has(normalize(ref)))
  };
};

const auditedSupportFrom = (input: {
  declaredSupport: LlmAgentClaimEvidence["support"];
  matchedRefCount: number;
  missingRefCount: number;
}): LlmClaimAuditSupport => {
  if (input.declaredSupport === "unsupported") {
    return "unsupported";
  }

  if (input.matchedRefCount === 0) {
    return "unsupported";
  }

  if (input.missingRefCount > 0 || input.declaredSupport === "partial") {
    return "partial";
  }

  return "supported";
};

const auditClaim = (claim: LlmAgentClaimEvidence, observedRefs: Set<string>): LlmClaimAuditRow => {
  const queryRefs = splitRefs(claim.queryRefs, observedRefs);
  const evidenceRefs = splitRefs(claim.evidenceRefs, observedRefs);
  const matchedRefCount = queryRefs.matched.length + evidenceRefs.matched.length;
  const missingRefCount = queryRefs.missing.length + evidenceRefs.missing.length;
  const auditedSupport = auditedSupportFrom({
    declaredSupport: claim.support,
    matchedRefCount,
    missingRefCount
  });
  const findings = [
    matchedRefCount > 0 ? "claim cites observed provenance" : "claim has no observed provenance match",
    missingRefCount > 0 ? "claim includes unobserved refs" : "all declared refs were observed",
    claim.limitation ? "claim states limitation" : "claim omits limitation"
  ];

  return {
    claim: claim.claim,
    declaredSupport: claim.support,
    auditedSupport,
    matchedQueryRefs: queryRefs.matched,
    missingQueryRefs: queryRefs.missing,
    matchedEvidenceRefs: evidenceRefs.matched,
    missingEvidenceRefs: evidenceRefs.missing,
    ...(claim.limitation ? { limitation: claim.limitation } : {}),
    findings
  };
};

const statusFrom = (rows: LlmClaimAuditRow[]): LlmClaimAuditStatus => {
  if (rows.length === 0 || rows.some((row) => row.auditedSupport === "unsupported")) {
    return "FAIL";
  }

  if (rows.some((row) => row.auditedSupport === "partial" || row.missingEvidenceRefs.length > 0 || row.missingQueryRefs.length > 0)) {
    return "WARN";
  }

  return "PASS";
};

export const auditLlmClaims = (input: {
  answer: LlmAgentAnswer;
  observations: LlmAgentObservation[];
}): LlmClaimAuditReport => {
  const observedRefs = observedReferenceSet(input.observations);
  const claims = (input.answer.claimEvidenceMatrix ?? []).map((claim) => auditClaim(claim, observedRefs));
  const hallucinatedRefs = unique(claims.flatMap((claim) => [...claim.missingQueryRefs, ...claim.missingEvidenceRefs]));

  return {
    source: "splunkready-llm-claim-audit",
    contractVersion: "llm-claim-audit-v1",
    advisoryOnly: true,
    passFailAuthority: "deterministic-rule-engine",
    status: statusFrom(claims),
    totalClaims: claims.length,
    supportedClaims: claims.filter((claim) => claim.auditedSupport === "supported").length,
    partialClaims: claims.filter((claim) => claim.auditedSupport === "partial").length,
    unsupportedClaims: claims.filter((claim) => claim.auditedSupport === "unsupported").length,
    hallucinatedRefs,
    observedRefs: observedRefsFrom(input.observations),
    claims
  };
};
