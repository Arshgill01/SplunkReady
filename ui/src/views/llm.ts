import type { UiArtifactBundle, LlmDeliberationArtifact } from "../artifacts.js";
import { value, renderFactTable } from "./helpers.js";
import { renderMcpProofList } from "./mcp.js";

export const llmPhaseLabel = (artifact: LlmDeliberationArtifact | undefined, fallback: string): string =>
  artifact ? `${artifact.phase} / ${artifact.outputQuality.grade} / ${artifact.outputQuality.score}` : `${fallback} not loaded`;

export const renderLlmDimensionRows = (artifact: LlmDeliberationArtifact): Array<[string, unknown]> =>
  artifact.outputQuality.dimensions.map((dimension) => [
    dimension.dimension,
    `${dimension.score}/${dimension.maxScore}`
  ]);

export const renderLlmClaimAuditRows = (artifact: LlmDeliberationArtifact): Array<[string, unknown]> => {
  const audit = artifact.claimAudit;

  if (!audit) {
    return [["Claim audit", "not recorded"]];
  }

  return [
    ["Claim audit", audit.status],
    ["Claims", `${audit.supportedClaims} supported / ${audit.partialClaims} partial / ${audit.unsupportedClaims} unsupported`],
    ["Hallucinated refs", audit.hallucinatedRefs.length > 0 ? audit.hallucinatedRefs.join(", ") : "none"],
    ["Observed tools", audit.observedRefs.toolNames.join(" / ") || "none"],
    ["Observed query refs", audit.observedRefs.queryRefs.join(" / ") || "none"],
    ["Observed evidence refs", audit.observedRefs.evidenceRefs.join(" / ") || "none"]
  ];
};

export const renderLlmClaimAuditList = (artifact: LlmDeliberationArtifact): string => {
  const audit = artifact.claimAudit;

  if (!audit || audit.claims.length === 0) {
    return renderMcpProofList(["No claim audit rows recorded."], "stage-list");
  }

  return renderMcpProofList(
    audit.claims.map((claim) => {
      const matchedRefs = [...claim.matchedQueryRefs, ...claim.matchedEvidenceRefs];
      const missingRefs = [...claim.missingQueryRefs, ...claim.missingEvidenceRefs];
      return `${claim.auditedSupport.toUpperCase()} / declared ${claim.declaredSupport}: ${claim.claim}; matched ${
        matchedRefs.length > 0 ? matchedRefs.join(", ") : "none"
      }; missing ${missingRefs.length > 0 ? missingRefs.join(", ") : "none"}; limitation ${
        claim.limitation ?? "not recorded"
      }`;
    }),
    "stage-list"
  );
};

export const renderLlmDeliberationSummary = (bundle: UiArtifactBundle): string => {
  const before = bundle.llmDeliberationBefore;
  const after = bundle.llmDeliberationAfter;
  const advisoryOnly = before?.advisoryOnly ?? after?.advisoryOnly;

  return `<section class="panel llm-deliberation-panel">
    <h2>LLM advisory boundary</h2>
    ${renderFactTable([
      ["Before", llmPhaseLabel(before, "before")],
      ["After", llmPhaseLabel(after, "after")],
      ["Advisory only", advisoryOnly ? "yes" : "not loaded"],
      ["Pass/fail authority", before?.passFailAuthority ?? after?.passFailAuthority ?? "deterministic-rule-engine"],
      ["Receipt verdict", bundle.receipt?.verdict ?? "not loaded"],
      ["Receipt score", bundle.receipt?.score ?? "not loaded"],
      ["Mutation", "no"]
    ])}
  </section>`;
};

export const renderLlmArtifactMissing = (bundle: UiArtifactBundle): string => {
  if (bundle.llmDeliberationBefore || bundle.llmDeliberationAfter) {
    return "";
  }

  return `<section class="panel llm-deliberation-panel">
    <h2>LLM deliberation not loaded</h2>
    ${renderFactTable([
      ["Artifact base", bundle.artifactBase],
      ["Expected files", "llm-deliberation-before.json / llm-deliberation-after.json"],
      ["Generate", "npm run splunkready -- llm-proof --out artifacts/llm-fixture-proof --json"],
      ["Role", "structured planning, provenance, uncertainty, and safety evidence"],
      ["Authority", "deterministic-rule-engine"]
    ])}
  </section>`;
};

export const renderLlmPhase = (artifact: LlmDeliberationArtifact | undefined, title: string): string => {
  if (!artifact) {
    return `<section class="panel llm-deliberation-panel">
      <h2>${value(title)}</h2>
      <p class="empty">LLM deliberation artifact not loaded.</p>
    </section>`;
  }

  const planToolCalls = artifact.plan.toolCalls.map((toolCall) => `${toolCall.toolName}: ${JSON.stringify(toolCall.input)}`);
  const observations = artifact.observations.map((observation) => {
    const evidence = observation.evidenceRefs.length > 0 ? observation.evidenceRefs.join(", ") : "none";
    return `${observation.toolName}: ${observation.summary}; resultCount ${observation.resultCount ?? "n/a"}; provenance ${observation.queryRef ?? "none"}; evidence ${evidence}`;
  });
  const findings = artifact.outputQuality.findings.map(
    (finding) =>
      `${finding.id} / ${finding.dimension} / ${finding.status} / ${finding.points}/${finding.maxPoints}: ${finding.detail}`
  );

  return `<section class="panel llm-deliberation-panel">
    <h2>${value(title)}</h2>
    ${renderFactTable([
      ["Phase", artifact.phase],
      ["Grade", artifact.outputQuality.grade],
      ["Quality score", artifact.outputQuality.score],
      ["Advisory only", artifact.advisoryOnly ? "yes" : "no"],
      ["Pass/fail authority", artifact.passFailAuthority],
      ["Mission understanding", artifact.plan.missionUnderstanding ?? "not recorded"],
      ["Rationale", artifact.plan.rationale],
      ["Risk controls", artifact.plan.riskControls?.join(" / ") ?? "not recorded"],
      ["Evidence strategy", artifact.plan.evidenceStrategy?.join(" / ") ?? "not recorded"],
      ["Self-check", artifact.plan.selfCheck?.join(" / ") ?? "not recorded"],
      ["Tool calls", planToolCalls.length > 0 ? planToolCalls.join(" / ") : "none"],
      ["Observations", observations.length > 0 ? observations.join(" / ") : "none"],
      ["Decision trace", artifact.answer.decisionTrace?.join(" / ") ?? "not recorded"],
      ["Provenance summary", artifact.answer.provenanceSummary ?? "not recorded"],
      ["Uncertainty", artifact.answer.uncertainty?.join(" / ") ?? "not recorded"],
      ["Safety notes", artifact.answer.safetyNotes?.join(" / ") ?? "not recorded"],
      ["Next actions", artifact.answer.nextActions?.join(" / ") ?? "not recorded"],
      ["Final answer", artifact.answer.finalAnswer]
    ])}
    <div class="llm-quality-grid">
      <section>
        <h3>Dimension scores</h3>
        ${renderFactTable(renderLlmDimensionRows(artifact))}
      </section>
      <section>
        <h3>Output-quality findings</h3>
        ${renderMcpProofList(findings, "stage-list")}
      </section>
      <section>
        <h3>Claim audit</h3>
        ${renderFactTable(renderLlmClaimAuditRows(artifact))}
      </section>
      <section>
        <h3>Claim evidence</h3>
        ${renderLlmClaimAuditList(artifact)}
      </section>
    </div>
  </section>`;
};

export const renderLlmDeliberation = (bundle: UiArtifactBundle): string =>
  `<main class="view" data-view="llm-deliberation">
    <section class="workbench">
      <div class="section-title">
        <h1>LLM deliberation</h1>
      </div>
      <div class="receipt-ledger">
        ${renderLlmDeliberationSummary(bundle)}
        ${renderLlmArtifactMissing(bundle)}
        ${renderLlmPhase(bundle.llmDeliberationBefore, "Before policy injection")}
        ${renderLlmPhase(bundle.llmDeliberationAfter, "After policy injection")}
      </div>
    </section>
  </main>`;
