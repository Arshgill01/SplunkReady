import { type EnvironmentContract, type ReadinessProfile } from "../../schemas/core.js";
import { type MissionDefinition } from "../../missions/dsl.js";
import { type UiArtifacts } from "../shell.js";
import { escapeHtml, escapeValue, renderEmptyTableRow } from "./helpers.js";

export const preferredSavedSearchRefs = (missions: MissionDefinition[]): Set<string> =>
  new Set(missions.flatMap((mission) => mission.preferredSavedSearchRefs ?? []));

export const renderIndexRows = (contract: EnvironmentContract): string => {
  if (contract.indexes.length === 0) {
    return renderEmptyTableRow(2, "No indexes compiled in contract.");
  }

  const restricted = new Set(contract.restrictedIndexes);

  return contract.indexes
    .map((index) => {
      const access = restricted.has(index.name) || index.sensitive ? "restricted" : "available";

      return `<tr>
        <td><code>${escapeHtml(index.name)}</code></td>
        <td>${escapeHtml(access)}</td>
      </tr>`;
    })
    .join("");
};

export const renderSourcetypeRows = (contract: EnvironmentContract): string => {
  if (contract.sourcetypes.length === 0) {
    return renderEmptyTableRow(2, "No sourcetypes compiled in contract.");
  }

  return contract.sourcetypes
    .map(
      (sourcetype) => `<tr>
        <td><code>${escapeHtml(sourcetype.name)}</code></td>
        <td>${sourcetype.fields.map((field) => `<code>${escapeHtml(field)}</code>`).join(" ")}</td>
      </tr>`
    )
    .join("");
};

export const renderCanonicalFieldRows = (contract: EnvironmentContract): string => {
  const rows = Object.entries(contract.canonicalFields).map(
    ([alias, canonical]) => `<tr>
      <td><code>${escapeHtml(alias)}</code></td>
      <td><code>${escapeHtml(canonical)}</code></td>
    </tr>`
  );

  for (const dataModel of contract.dataModels) {
    const metadata = dataModel.metadata;

    if (metadata && typeof metadata === "object" && "absentFields" in metadata && Array.isArray(metadata.absentFields)) {
      for (const absentField of metadata.absentFields) {
        rows.push(`<tr>
          <td><code>${escapeValue(absentField)}</code></td>
          <td>absent from ${escapeHtml(String(dataModel.name))}</td>
        </tr>`);
      }
    }
  }

  if (rows.length === 0) {
    return renderEmptyTableRow(2, "No canonical fields or absent fields compiled in contract.");
  }

  return rows.join("");
};

export const renderSavedSearchRows = (contract: EnvironmentContract, missions: MissionDefinition[]): string => {
  if (contract.savedSearches.length === 0) {
    return renderEmptyTableRow(2, "No saved searches compiled in contract.");
  }

  const preferredRefs = preferredSavedSearchRefs(missions);

  return contract.savedSearches
    .map((savedSearch) => {
      const ref = `${savedSearch.app}::${savedSearch.name}`;
      const status = preferredRefs.has(ref) ? "preferred for mission" : "available";

      return `<tr>
        <td><code>${escapeHtml(ref)}</code></td>
        <td>${escapeHtml(status)}</td>
      </tr>`;
    })
    .join("");
};

export const renderKnowledgeSummaryRows = (contract: EnvironmentContract): string => {
  const rows = [
    ["Macros", contract.macros.map((macro) => `${macro.app}::${macro.name}`)],
    ["Lookups", contract.lookups.map((lookup) => `${lookup.app}::${lookup.name}`)],
    ["Data models", contract.dataModels.map((dataModel) => String(dataModel.name))],
    ["App contexts", contract.appContexts]
  ];

  return rows
    .map(
      ([label, values]) => `<tr>
        <th>${escapeHtml(label as string)}</th>
        <td>${(values as string[]).length > 0 ? (values as string[]).map((value) => `<code>${escapeHtml(value)}</code>`).join(" ") : "None"}</td>
      </tr>`
    )
    .join("");
};

export const renderEvidenceRuleRows = (contract: EnvironmentContract): string => {
  if (contract.evidenceRules.length === 0) {
    return `<tr><td colspan="2">No evidence rules compiled.</td></tr>`;
  }

  return contract.evidenceRules
    .map((rule) => {
      const id = typeof rule.id === "string" ? rule.id : "evidence-rule";
      const requirements = Object.entries(rule)
        .filter(([key]) => key !== "id")
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join(", ");

      return `<tr>
        <td><code>${escapeHtml(id)}</code></td>
        <td>${escapeHtml(requirements)}</td>
      </tr>`;
    })
    .join("");
};

export const renderReadinessProfileRows = (profile: ReadinessProfile | undefined): string => {
  if (!profile) {
    return `<tr><td colspan="3">No readiness-profile.json artifact loaded.</td></tr>`;
  }

  const rows = profile.ruleBindings
    .slice(0, 8)
    .map(
      (binding) => `<tr>
        <td><code>${escapeHtml(binding.ruleId)}</code><br>${escapeHtml(binding.severity)}</td>
        <td>${escapeHtml(binding.source)}<br>${binding.contractRefs.map((ref) => `<code>${escapeHtml(ref)}</code>`).join(" ")}</td>
        <td>${binding.evidence.map((item) => `<code>${escapeHtml(item.ref)}</code>`).join(" ")}</td>
      </tr>`
    )
    .join("");
  const hiddenCount = Math.max(0, profile.ruleBindings.length - 8);
  const footer =
    hiddenCount > 0
      ? `<tr><td colspan="3">${escapeValue(hiddenCount)} additional deployment-bound rule(s) in readiness-profile.json.</td></tr>`
      : "";

  return `${rows}${footer}`;
};

export const renderContractView = (artifacts: UiArtifacts): string => {
  if (!artifacts.contract) {
    return `<section id="contract" class="shell-section" data-route-panel="contract" aria-label="Environment contract">
      <h2>Environment contract</h2>
      <p class="empty">No environment-contract.json artifact loaded.</p>
    </section>`;
  }

  const { contract } = artifacts;

  return `<section id="contract" class="shell-section" data-route-panel="contract" aria-label="Environment contract">
    <h2>Environment contract</h2>
    <div class="contract-grid">
      <div>
        <h3>Indexes</h3>
        <table>
          <thead><tr><th>Index</th><th>Access</th></tr></thead>
          <tbody>${renderIndexRows(contract)}</tbody>
        </table>
      </div>
      <div>
        <h3>Sourcetype fields</h3>
        <table>
          <thead><tr><th>Sourcetype</th><th>Fields</th></tr></thead>
          <tbody>${renderSourcetypeRows(contract)}</tbody>
        </table>
      </div>
      <div>
        <h3>Canonical fields</h3>
        <table>
          <thead><tr><th>Observed or alias</th><th>Compiled contract guidance</th></tr></thead>
          <tbody>${renderCanonicalFieldRows(contract)}</tbody>
        </table>
      </div>
      <div>
        <h3>Saved searches</h3>
        <table>
          <thead><tr><th>Object ref</th><th>Use</th></tr></thead>
          <tbody>${renderSavedSearchRows(contract, artifacts.missions)}</tbody>
        </table>
      </div>
      <div>
        <h3>Knowledge graph summary</h3>
        <table>
          <tbody>${renderKnowledgeSummaryRows(contract)}</tbody>
        </table>
      </div>
      <div>
        <h3>Budgets and evidence rules</h3>
        <table>
          <tbody>
            <tr><th>maxToolCalls</th><td>${escapeValue(contract.queryBudgets.maxToolCalls)}</td></tr>
            <tr><th>maxResultRows</th><td>${escapeValue(contract.queryBudgets.maxResultRows)}</td></tr>
            <tr><th>timeoutSeconds</th><td>${escapeValue(contract.queryBudgets.timeoutSeconds)}</td></tr>
          </tbody>
        </table>
        <table class="stacked-table">
          <thead><tr><th>Evidence rule</th><th>Requirements</th></tr></thead>
          <tbody>${renderEvidenceRuleRows(contract)}</tbody>
        </table>
      </div>
      <div>
        <h3>Readiness profile</h3>
        <table>
          <thead><tr><th>Rule</th><th>Activation source</th><th>Evidence refs</th></tr></thead>
          <tbody>${renderReadinessProfileRows(artifacts.readinessProfile)}</tbody>
        </table>
      </div>
    </div>
  </section>`;
};
