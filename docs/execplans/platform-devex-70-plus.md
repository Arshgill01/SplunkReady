# ExecPlan: Platform & Developer Experience 70%+ Push

Created: 2026-06-12

## Objective

Raise SplunkReady from a strong-but-noisy project into a serious major-category
contender, with Platform & Developer Experience as the first target and Best
Use of Splunk MCP Server as the paired bonus target.

The target is not a fake 90% confidence score. The target is to make a harsh
assessment reach at least:

- Platform & Developer Experience: 70%+
- Best Use of Splunk MCP Server: 55%+
- Overall major-category win chance: 45%+
- Feedback prize preparedness: 80%+

## Current Harsh Baseline

| Surface | Baseline | Main drag |
|---|---:|---|
| Platform & Developer Experience | 38% | Onboarding/evidence sprawl hides the developer workflow. |
| Best Use of Splunk MCP Server | 28% | MCP proof exists, but the first impression can read as "certification around MCP" instead of "trust layer for Splunk MCP agents." |
| Best Use of Splunk Developer Tools | 22% | Good supporting evidence, but external Splunkbase blockers cap it. |
| Best Use of Splunk Hosted Models | 8% | Live entitlement remains blocked; advisory-only design is correct but not prize-maximizing. |
| Security track | 18% | Strong security demo story, but the product is a readiness gate, not a direct SOC workflow. |
| Observability track | 8% | Secondary evidence only. |

## North-Star Reframe

Any agent can call Splunk MCP. SplunkReady proves whether that agent is safe,
correct, and deployment-aware before production.

The product should feel like CI for Splunk agents:

1. install or run with one command;
2. compile the Splunk environment into a contract;
3. run or import an agent trace;
4. deterministically grade the trace;
5. emit a Readiness Receipt that can gate PRs, releases, or agent deployment.

## Probability Gate Criteria

### Gate 1: Judge Path Clarity

Target probability after gate: Platform 50-55%, MCP 35-40%.

Required evidence:

- README top gives one no-clone command, one clone command, one MCP proof
  command, and one evidence link before release history.
- `submission-evidence/JUDGE-PATH.md` lists only the evidence judges should open.
- `moves/` and `logs/reviewer-inbox/` are visibly labeled as build history, not
  onboarding.
- Submission-copy audit remains green.

### Gate 2: Developer Workflow Proof

Target probability after gate: Platform 60-65%, MCP 42-48%.

Required evidence:

- Workbench default route and public demo route show the clearest developer
  workflow first.
- CI/PR gate evidence is visible in README and judge path.
- Trace bridge/import path is presented as a developer integration, not a side
  feature.
- Browser screenshots prove the first route is not overloaded.

### Gate 3: MCP Trust-Layer Proof

Target probability after gate: Platform 65-70%, MCP 55-60%.

Required evidence:

- MCP proof docs lead with "Splunk MCP agent behavior certified into a
  Readiness Receipt."
- Captured Splunk MCP transcript, dual-server config, Zed/external-client
  evidence, and local SplunkReady MCP certification server are one story.
- The local SplunkReady MCP server is framed as the certification interface,
  not a replacement for Splunk MCP Server.

### Gate 4: Feedback Prize Packet

Target probability after gate: Feedback preparedness 80%+.

Required evidence:

- `logs/splunk-feedback.md` is curated into themes with specific observed
  friction, impact, and constructive suggestions.
- A draft `docs/splunk-feedback-form-answers.md` exists with strong concise
  answers that can be pasted into the official form.
- When the official form is available in the browser, the questions are mapped
  exactly and the draft answers are adjusted.

### Gate 5: Final Full Verification

Target probability after gate: Platform 70%+, MCP 55%+, overall major-category
chance 45%+.

Required evidence:

- `npm run check` passes in a fully permissioned local environment.
- Public no-clone package smoke still passes.
- Public demo currentness audit passes or stale boundary is explicit.
- The demo script is aligned with the README and judge path.

## Work Sequence

1. Compress the judge path without changing runtime behavior.
2. Tighten README and evidence entrypoints.
3. Make the public/workbench first route support the developer workflow story.
4. Consolidate MCP proof copy and evidence.
5. Create feedback-prize answer packet.
6. Run full local gate and commit each completed slice.
7. Re-score after each gate using the table above.

## Stop/Do-Not-Chase Rules

- Do not chase Hosted Models unless live SAIA entitlement changes.
- Do not build a generic SOC copilot to compete in Security.
- Do not delete audit evidence just because it is noisy; hide or index it first.
- Do not weaken deterministic grading to look more AI-native.
- Do not claim Splunkbase availability or public video/feedback submission
  before those external steps are actually complete.

## Current Status

Gate 1 is implemented and locally verified.

Current harsh re-score after Gate 1:

| Surface | Before | After Gate 1 | Reason |
|---|---:|---:|---|
| Platform & Developer Experience | 38% | 50% | README and evidence entrypoints now expose the developer proof path before build history. |
| Best Use of Splunk MCP Server | 28% | 36% | MCP proof is easier to find from the judge path, but the workbench route still needs stronger first-screen MCP framing. |
| Best Use of Splunk Developer Tools | 22% | 28% | App/package evidence is easier to locate, but external Splunkbase blockers still cap this. |
| Feedback prize preparedness | 35% | 60% | The feedback log now has a theme summary and a draft answer bank; exact form mapping is still missing. |

Verification:

- `NPM_CONFIG_CACHE=/private/tmp/splunkready-npm-cache npm run check` passed.

Gate 2 is partially implemented.

Gate 2 progress:

- MCP proof view now leads with a Developer gate panel that ties Splunk MCP
  trace certification to Readiness Receipt, CI/npx proof paths, deterministic
  authority, and mutation boundary.
- README and `submission-evidence/JUDGE-PATH.md` now name PR gate, GitHub
  Action, trace bridge, and external-trace examples as first-class developer
  workflow surfaces.
- Public demo export still defaults to `mcp-proof` and browser verification
  passed on desktop and 390px mobile width.

Current harsh re-score after partial Gate 2:

| Surface | After Gate 1 | After partial Gate 2 | Reason |
|---|---:|---:|---|
| Platform & Developer Experience | 50% | 56% | The default demo route now opens on a clearer developer gate, but CI/trace import still need stronger visual proof. |
| Best Use of Splunk MCP Server | 36% | 43% | The first MCP screen now states the trust-layer workflow instead of burying it in lower panels. |
| Best Use of Splunk Developer Tools | 28% | 31% | Developer workflow surfaces are more visible, but external publication blockers remain. |

Next work: make CI/PR-gate and trace-import proof visible in the workbench or
judge path without bloating the first screen.
