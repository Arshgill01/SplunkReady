# Deadline Cleanup And Final-Lap Plan

Date: 2026-06-12

Purpose: cut repo noise before the hackathon deadline, preserve the strongest judge paths, and stop adding broad surfaces unless they materially improve award odds.

## Current State

SplunkReady is no longer a scaffold. The core engine is real: fixture and live paths share adapter contracts, deterministic rules produce Readiness Receipts, the public package path exists at `splunkready@0.1.7`, the local workbench exists, the MCP certification path exists, and the tracked evidence pack is extensive.

The main risk is no longer missing implementation. The main risk is signal dilution. The repo tells too many historical stories at once: waves, moves, reviewer loops, public package release evidence, Splunk app evidence, live stress artifacts, MCP proof variants, hosted model blockers, and UI routes. Judges need one clean path and two backup proofs, not the entire build diary.

## Award Positioning

These probabilities are strict estimates from the current repo state, not guarantees.

| Award surface | Current probability | Why |
|---|---:|---|
| Stage-one viability | 90% | The project fits the Agentic Ops theme, uses Splunk/MCP evidence, has runnable package paths, and avoids hidden mutation. Risk is judge confusion from too much repo surface. |
| Platform & Developer Experience track | 50% after Gate 1 | Strongest fit. The CI gate, package, action, trace bridge, workbench, and Readiness Receipt are developer infrastructure. Gate 1 reduced onboarding noise; remaining gap is first-screen workflow clarity. |
| Best Use of Splunk MCP Server | 36% after Gate 1 | The MCP story is credible because SplunkReady certifies Splunk MCP transcripts and exposes a local certification MCP server. Gate 1 made the proof easier to find; remaining gap is stronger first-screen MCP framing. |
| Best Use of Splunk Developer Tools | 28% after Gate 1 | Package, action, Splunk app package, AppInspect evidence, and CI workflow help. Odds are capped by external Splunkbase blockers and the fact that this is not primarily a Splunk app UX. |
| Best Use of Splunk Hosted Models | 8% | Hosted-model support is advisory and honest, but live hosted-model access remains blocked in evidence. Do not chase this unless entitlement is resolved quickly. |
| Design criterion within Stage Two | 30% | The workbench is functional and evidence-led, but it is dense. Final polish should hide secondary routes and make the first five minutes obvious. |
| Technological implementation criterion | 55% | This is the strongest judging criterion: deterministic grading, schemas, tests, package audits, receipt chains, and mutation controls are substantial. |
| Potential impact criterion | 45% | Strong concept: CI for Splunk agents. The remaining work is narrative compression and buyer/developer workflow clarity. |
| Quality of idea criterion | 50% | The idea is differentiated if framed as certification before production, not another SOC copilot. Noise lowers this if judges cannot see the thesis quickly. |

Best strategic target: Platform & Developer Experience, with MCP as the bonus story. Do not reposition toward Hosted Models unless live entitlement changes.

## Noise To Cut

Cut means hide, archive, compress, or stop emphasizing. It does not always mean delete.

| Priority | Surface | Action | Reason |
|---:|---|---|---|
| P0 | README front half | Replace the long release-history flow with a judge path, developer path, MCP path, and evidence path. Move release details lower or into evidence docs. | First impression is overloaded. |
| P0 | Workbench default route | Default to one judge-facing proof route: receipt/replay or MCP proof, with secondary routes collapsed. | Current route count reads like an internal tool. |
| P0 | Submission evidence index | Create a compact `submission-evidence/JUDGE-PATH.md` with the 5 artifacts judges should inspect. | The existing evidence is strong but too broad. |
| P0 | Hosted-model claims | Keep as advisory and blocked where blocked. Do not spend final time trying to win this category without entitlement. | Low award probability and high external dependency. |
| P1 | `moves/` directory | Keep tracked history, but add an index note that judges should ignore it. Do not add more move files unless required for traceability. | 209 move files are build diary noise. |
| P1 | `logs/reviewer-inbox/` | Keep auditability, but summarize latest clean state in one current reviewer summary. | 211 files look unresolved even when latest verdicts pass. |
| P1 | Root status docs | Keep status current at Move 208 or later. Avoid stale Move 106/Wave 41 language. | Stale status reduces confidence. |
| P1 | Public package currentness gap | Either publish next version or state source-ahead-of-npm plainly in one place. | Mixed source/currentness copy is confusing. |
| P2 | Large UI modules | Defer deep refactor unless UI bugs appear. `ui/src/render.ts` is large, but refactoring now risks regressions. | Deadline favors proof clarity over code aesthetics. |
| P2 | `src/workflows/mcp-proof.ts` | Defer module split unless needed for MCP story polish. | Large but tested and central to bonus evidence. |
| P2 | Splunkbase path | Keep as Developer Tools supporting evidence, not main story. | External publisher review cannot be completed inside repo. |

## Keep And Emphasize

- `npx -y splunkready@0.1.7 judge-proof --out ./judge-proof --json`
- `npm run judge-proof`
- `npm run mcp-proof`
- Readiness Receipt as the product artifact.
- Deterministic pass/fail authority.
- Fixture/live parity through the same interfaces.
- Mutation boundary: `mutation: false` and no hidden Splunk writes.
- CI/action usage for developer workflow.
- External trace and MCP transcript intake as the broad integration story.

## Architecture Deepening Opportunities

These are not all final-lap tasks. They identify where future maintainers will feel friction.

1. Files: `ui/src/render.ts`, `ui/src/artifacts.ts`, `ui/src/runBrowser.ts`
   Problem: the workbench renderer is a shallow module with many view-specific responsibilities behind one broad interface.
   Solution: split by product view only after deadline-critical UI is frozen.
   Benefits: better locality for UI fixes and clearer test surface per view.

2. Files: `src/workflows/mcp-proof.ts`, `src/mcp/server.ts`, `src/mcp/composition-recorder.ts`
   Problem: MCP proof composition has high leverage but a wide interface and many artifact responsibilities.
   Solution: extract artifact summarization and official-tool-coverage construction into internal modules after submission.
   Benefits: better locality around MCP award evidence without changing the external proof command.

3. Files: `submission-evidence/`, `logs/reviewer-inbox/`, `moves/`
   Problem: evidence history is valuable but overwhelms the live judge path.
   Solution: add compact judge indexes and stop expanding historical logs during final polish.
   Benefits: higher judge leverage per document opened; lower risk that stale history looks like unresolved work.

4. Files: `README.md`, `docs/hackathon-rubric.md`, `submission-evidence/claim-ledger.md`
   Problem: award positioning exists but is scattered.
   Solution: consolidate final submission narrative into one short doc and link to detailed evidence only where needed.
   Benefits: better locality for submission copy and fewer contradictory claims.

## Final-Lap Plan

### Lap 1: Noise Gate

- Add `submission-evidence/JUDGE-PATH.md`.
- Shorten the top of `README.md` to one judge command, one no-clone command, one MCP command, and one evidence link.
- Add an explicit note in `moves/README.md` that `moves/` is build history, not judge onboarding.
- Add a current reviewer summary in `logs/reviewer-inbox/README.md`.
- Run `npm run verify:scaffold`, `npm run audit:submission-copy`, and `git diff --check`.

### Lap 2: Workbench Judge Path

- Decide the default public demo route: prefer the route that best supports the 3-minute video.
- Collapse or de-emphasize secondary tabs that do not support Platform & Developer Experience or MCP proof.
- Verify with browser screenshots at desktop and mobile widths.
- Run `npm run ui:build`, focused UI tests, and `npm run audit:public-demo-export`.

### Lap 3: Evidence Freshness

- Regenerate only the evidence needed for the final judge path.
- Do not regenerate every historical proof pack.
- Refresh claim ledger entries only for claims that appear in README, Devpost copy, or demo script.
- Run `npm run judge-proof`, `npm run mcp-proof`, and `npm run audit:submission-copy`.

### Lap 4: Release Boundary

- If publishing is feasible, bump above `0.1.7`, publish, and rerun public currentness audit.
- If publishing is not feasible, keep `0.1.7` as the public no-clone path and state that source has advanced beyond npm.
- Do not let package currentness block the video if the no-clone proof still passes.

### Lap 5: Video And Submission

- Record the 3-minute story from `docs/demo-script.md`, but trim architecture detail.
- Show one proof command, one receipt, one trace violation group, one policy patch, and one pass result.
- In final copy, lead with: "CI for Splunk agents: compile environment, run missions, grade trace, produce Readiness Receipt."

## Do Not Spend Final Time On

- New broad features.
- Hosted-model award chase without entitlement.
- Deep UI/module refactors not tied to the video or judge path.
- More proof variants under `artifacts/`.
- More historical move files unless a repo rule requires them.
- Splunkbase publication claims before external review is complete.

## Validation Snapshot

Commands run during this analysis:

- `npm run check`: partial; failed at `npm pack --dry-run` because `/Users/arshdeepsingh/.npm` contains root-owned cache files.
- `NPM_CONFIG_CACHE=/private/tmp/splunkready-npm-cache npm run check`: partial; passed through package readiness, then failed package installability because sandboxed network could not resolve `registry.npmjs.org`.
- `NPM_CONFIG_CACHE=/private/tmp/splunkready-npm-cache npm run audit:package-installability`: PASS with approved network access.
- `npm test -- tests/workbench/server.test.ts --reporter verbose`: failed in sandbox with `listen EPERM: operation not permitted 127.0.0.1`.
- `npm test -- tests/workbench/server.test.ts --reporter verbose`: PASS with approved loopback binding.
- `npm test`: PASS with approved loopback binding; 77 files and 448 tests passed.

Open validation gap: rerun the full `npm run check` in an environment with writable npm cache, npm registry access, and loopback bind permission before final submission.
