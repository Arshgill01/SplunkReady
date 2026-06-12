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

Gate 2 is implemented for the MCP proof and PR-gate public-demo surfaces.

Gate 2 progress:

- MCP proof view now leads with a Developer gate panel that ties Splunk MCP
  trace certification to Readiness Receipt, CI/npx proof paths, deterministic
  authority, and mutation boundary.
- README and `submission-evidence/JUDGE-PATH.md` now name PR gate, GitHub
  Action, trace bridge, and external-trace examples as first-class developer
  workflow surfaces.
- Public demo export still defaults to `mcp-proof` and browser verification
  passed on desktop and 390px mobile width.
- Public demo export now includes `artifacts/ci-pr-gate`, the artifact selector
  exposes it as `PR gate`, and the direct PR-gate route loads the generated PR
  comment and PASS receipt evidence in the browser.

Current harsh re-score after Gate 2:

| Surface | After Gate 1 | After Gate 2 | Reason |
|---|---:|---:|---|
| Platform & Developer Experience | 50% | 60% | The default demo route now opens on a clearer developer gate and the hosted artifact pack includes the CI/PR gate proof. Trace import still needs a more obvious judge-facing path. |
| Best Use of Splunk MCP Server | 36% | 44% | The first MCP screen now states the trust-layer workflow instead of burying it in lower panels; direct MCP transcript import is still too hidden. |
| Best Use of Splunk Developer Tools | 28% | 34% | PR gate evidence is now exported and browser-verifiable, but external publication blockers still cap this category. |

Next work: make trace-import proof and the `npx splunkready` quickstart path
visible in one judge-facing workflow without bloating the first screen.

Gate 3 is implemented for the hosted transcript-import quickstart path.

Gate 3 progress:

- The MCP proof Developer gate now shows the exact credential-free quickstart
  command and the strict transcript certification command.
- The public demo export now materializes
  `submission-evidence/mcp-proof/mcp-transcript-certification` as the
  first-class hosted artifact base `artifacts/mcp-transcript`.
- The public-demo export audit now requires the transcript certification,
  transcript import summary, receipt, and proof audit files.
- In-app browser verification passed for both the default MCP proof route and
  the direct transcript proof route.

Current harsh re-score after Gate 3:

| Surface | After Gate 2 | After Gate 3 | Reason |
|---|---:|---:|---|
| Platform & Developer Experience | 60% | 65% | A judge can now follow MCP proof -> npx quickstart -> strict transcript gate -> direct hosted receipt without cloning or guessing hidden artifact paths. The remaining gap is a single polished one-command/demo script path. |
| Best Use of Splunk MCP Server | 44% | 50% | Transcript import is now directly loadable as public proof, which makes the MCP trust-layer story more concrete. It still needs a cleaner side-by-side Splunk MCP vs SplunkReady MCP narrative. |
| Best Use of Splunk Developer Tools | 34% | 38% | Hosted proof now includes a CI gate and transcript certification gate, but Splunkbase/AppInspect external blockers remain the ceiling. |

Next work: collapse the final judge path into one polished command/demo script
and make the feedback-prize packet exact enough to paste once the official form
is available.

Gate 4 is implemented for the one-command Platform proof wrapper.

Gate 4 progress:

- Added `npm run platform-proof`, a credential-free wrapper that builds the CLI,
  runs the fixture demo, runs `judge-proof`, certifies the sample Splunk MCP
  transcript with strict import and require-pass gates, then writes a JSON and
  markdown proof summary under `artifacts/platform-devex-proof`.
- The wrapper reads the actual before/after fixture receipts and external MCP
  transcript receipt, so the summary shows `NOT READY -> READY` plus transcript
  `READY` instead of relying on prose.
- README and `submission-evidence/JUDGE-PATH.md` now put this wrapper in the
  clone path before lower-level commands.

Current harsh re-score after Gate 4:

| Surface | After Gate 3 | After Gate 4 | Reason |
|---|---:|---:|---|
| Platform & Developer Experience | 65% | 70% | The core developer story now has a single local command that proves fixture demo, judge proof, and strict MCP transcript certification with machine-readable output. This reaches the lower bound of serious finalist contention, not a lock. |
| Best Use of Splunk MCP Server | 50% | 52% | The wrapper includes strict MCP transcript certification, but MCP-specific judging still wants stronger live/official Splunk MCP framing. |
| Best Use of Splunk Developer Tools | 38% | 40% | The command improves developer ergonomics, but the category ceiling remains limited by external Splunkbase/AppInspect publication blockers. |

Next work: strengthen the public/hosted demonstration around this one-command
proof and tighten the feedback-prize answer packet against the official form
when accessible.

Gate 5 is implemented for public-demo visibility of the Platform proof.

Gate 5 progress:

- Public demo export now generates `artifacts/platform-devex-proof` from the
  same `run-platform-devex-proof` wrapper used by `npm run platform-proof`.
- The workbench artifact selector includes `Platform proof`, and the proof
  browser renders a Platform proof panel with status, mutation boundary,
  deterministic authority, fixture `NOT READY -> READY`, transcript `READY`,
  commands, and routes.
- Public-demo export audit now requires the Platform proof summary, markdown,
  before/after fixture receipts, and MCP transcript receipt.
- Browser navigation to the Platform proof route was attempted, but the in-app
  browser blocked follow-up inspection under its URL policy. This was not
  bypassed through another browser. Renderer tests and public export audits
  cover the route content instead.

Current harsh re-score after Gate 5:

| Surface | After Gate 4 | After Gate 5 | Reason |
|---|---:|---:|---|
| Platform & Developer Experience | 70% | 73% | The one-command proof is now also a generated hosted-demo artifact with first-class workbench rendering and audit requirements. Browser policy blocked a manual route inspection, so this is not pushed higher. |
| Best Use of Splunk MCP Server | 52% | 54% | Public proof now includes the transcript certification in the Platform path, but the MCP-specific narrative still needs a cleaner official Splunk MCP comparison. |
| Best Use of Splunk Developer Tools | 40% | 42% | The hosted proof path improves developer ergonomics and CI-style evidence, while external publication blockers remain. |

Next work: tighten the feedback answer packet and, if possible without policy
workarounds, map the official feedback form fields exactly.

Gate 6 is implemented for feedback-prize packet hardening.

Gate 6 progress:

- Rechecked the public Devpost feedback and rules surfaces. The public pages
  confirm an online feedback-form requirement and actionable-comment standard,
  but do not expose exact Google Form question labels through fetched HTML.
- Converted `docs/splunk-feedback-form-answers.md` from a loose answer bank
  into a field-mapped, paste-ready packet covering project context, primary
  feedback, bug/friction report, documentation improvement, SDK/integration
  improvement, sample-data/demo improvement, AppInspect/package improvement,
  and impact.
- Updated `logs/splunk-feedback.md` so it no longer points at a nonexistent
  next artifact and clearly records the remaining submission boundary:
  authenticated form open, exact field paste, final confirmation capture.

Current harsh re-score after Gate 6:

| Surface | After Gate 5 | After Gate 6 | Reason |
|---|---:|---:|---|
| Platform & Developer Experience | 73% | 73% | Feedback packet cleanup does not materially change the judged platform artifact path. |
| Best Use of Splunk MCP Server | 54% | 55% | The feedback packet now crisply explains MCP readiness gaps and official improvement asks, but this is category-adjacent evidence, not product proof. |
| Best Use of Splunk Developer Tools | 42% | 44% | The packet better frames SDK, docs, AppInspect, and packaging friction in actionable terms. It still needs actual form submission to count for the feedback prize. |
| Feedback prize preparedness | 60% | 75% | The answer packet is now paste-ready against the public requirement, but exact form labels and confirmation are still missing, so it is not pushed to 80%+. |

Next work: either open the authenticated feedback form and map exact fields, or
return to product work by strengthening MCP-specific category proof beyond the
Platform wrapper.
