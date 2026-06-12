import type { UiArtifactBundle, SuiteProofSummary } from "../artifacts.js";
import { value, code, renderFactTable, renderProofAuditPanel } from "./helpers.js";

export const renderSuiteMissionRows = (summary: SuiteProofSummary): string =>
  summary.missions
    .map(
      (mission) => `<tr>
        <td>${code(mission.missionId)}<span>${value(mission.title)}</span></td>
        <td>${value(mission.domain)}</td>
        <td>${value(mission.proofLoop)}</td>
        <td>${value(`${mission.before.verdict} / ${mission.before.score} / ${mission.before.violations} violation(s)`)}</td>
        <td>${value(`${mission.after.verdict} / ${mission.after.score} / ${mission.after.violations} violation(s)`)}</td>
        <td>${value(mission.after.evidenceRefs.length)}</td>
        <td>${code(mission.artifactDir)}</td>
      </tr>`
    )
    .join("");

export const renderSuiteProof = (bundle: UiArtifactBundle): string => {
  const summary = bundle.suiteProofSummary;

  return `<main class="view" data-view="suite-proof">
    <section class="workbench">
      <div class="section-title">
        <h1>Suite proof</h1>
      </div>
      ${
        summary
          ? `<section class="panel">
              <h2>Suite summary</h2>
              ${renderFactTable([
                ["Status", summary.status],
                ["Mode", summary.mode],
                ["Suite", summary.suiteId],
                ["Title", summary.suiteTitle ?? "not recorded"],
                ["Manifest", summary.suitePath ?? "not recorded"],
                ["Missions", summary.missionCount],
                ["Domains", summary.domains.join(" / ")],
                ["Fail-to-pass missions", summary.totals.failToPass],
                ["READY after patch", summary.totals.readyAfterPatch],
                ["Evidence refs", summary.totals.evidenceRefs],
                ["Mutation", summary.mutation ? "yes" : "no"]
              ])}
            </section>
            ${renderProofAuditPanel(bundle.proofAudit)}
            <section class="panel suite-proof-panel">
              <h2>Mission ledger</h2>
              <table class="suite-table">
                <thead>
                  <tr>
                    <th>Mission</th>
                    <th>Domain</th>
                    <th>Proof loop</th>
                    <th>Before</th>
                    <th>After</th>
                    <th>Evidence</th>
                    <th>Artifacts</th>
                  </tr>
                </thead>
                <tbody>${renderSuiteMissionRows(summary)}</tbody>
              </table>
            </section>`
          : `<section class="panel">
              <h2>Suite summary not loaded</h2>
              ${renderFactTable([
                ["Artifact base", bundle.artifactBase],
                ["Expected file", "suite-proof-summary.json"],
                ["Generate", "npm run splunkready -- suite-proof --out artifacts/suite-proof --json"]
              ])}
            </section>`
      }
    </section>
  </main>`;
};
