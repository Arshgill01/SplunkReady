# SplunkReady Reviewed Moves

Prepared: 2026-06-04

This is the reviewed execution portfolio for the June 15, 2026 Splunk Agentic
Ops Hackathon submission. It replaces the first 18-move draft after checking
both source reports against the repository, current proof artifacts, locked
decisions, official rules, and six independent code-review passes.

## Source-Truth Corrections

- SplunkReady is entered in **Platform & Developer Experience**. Security is
  the flagship use case, not a second eligible track prize.
- A project may win one Grand Prize and one bonus prize. Probability and
  expected-value arithmetic is intentionally excluded from this plan.
- The repository declares **19** grader rule IDs, implements **14**, and
  activates all 19 across missions. Five activated checks are silently skipped.
- SAIA transport, payload mapping, diagnostics, and proof commands already
  exist. The remaining blocker is tenant plus MCP identity entitlement.
- The flagship live security fail-to-pass proof has succeeded locally. Its
  final judge-facing evidence still needs regeneration, redaction, and tracking.
- SplunkReady is currently a repository-local CLI integration and CI gate, not
  a distributable SDK or reusable GitHub Action.
- The Vite app is a static artifact app. Vite development middleware would only
  create a local operator workflow, not a backend in the production build.
- `policy-patch.json` intentionally contains proposed additive rules. It is not
  a deceptive or incomplete before/after policy diff.
- The app must remain read-only. No move adds automated Splunk setup or other
  Splunk write operations.
- The official rules require a public video under three minutes, visible AI
  usage, and a root `architecture_diagram.md`, `.pdf`, or `.png`.

Official rules: <https://splunk.devpost.com/rules>

## Priority Order

| Priority | Move | Estimate | Depends on | Ship condition |
|---|---|---:|---|---|
| P0 | [01](moves01.md) - fail closed on missing deterministic rules | 0.5-1d | - | Must ship |
| P0 | [02](moves02.md) - restore catalog-to-runtime rule truth | 1.5-2.5d | 01 | Must ship or narrow claims |
| P0 | [03](moves03.md) - fix fixture drift and fixture/live parity gaps | 0.5-1d | 01-02 | Must ship |
| P0 | [04](moves04.md) - make the canonical verification gate honest | 0.5d | 01-03 | Must ship |
| P1 | [05](moves05.md) - add one safe fixture certification workflow to Vite | 1.5-2.5d | 04 | Ship only while P0 remains green |
| P1 | [06](moves06.md) - produce a current sanitized public evidence pack | 0.5-1d | 04, 08 | Must ship |
| P1 | [07](moves07.md) - capture SAIA proof if entitlement becomes green | 0.5d | 04 | Conditional |
| P1 | [08](moves08.md) - make live security proof reproducible without mutation | 0.5-1d | 04 | Must ship |
| P1 | [09](moves09.md) - harden the external-agent CLI integration story | 0.5-1d | 04 | Must ship |
| P0 | [10](moves10.md) - reconcile README, Devpost, architecture, and claims | 1d | 06-09 | Must ship |
| P0 | [11](moves11.md) - record a compliant video and submit feedback | 1d | 06, 10 | Must ship |
| P0 | [12](moves12.md) - run clean-room submission and security QA | 0.5-1d | all shipped moves | Final gate |
| P1 | [13](moves13.md) - resolve the critical Vitest development advisory | 0.5d | 04 | Must resolve or explicitly mitigate |

## Recommended Schedule

1. Complete Moves 01-04 before judge-facing feature work. A certification
   harness cannot credibly optimize presentation while activated checks are
   silently ignored.
2. Run Moves 05-09 and 13 in parallel only where file ownership does not overlap.
   Move 05 is the only substantial new product behavior.
3. Freeze source behavior before Moves 10-12. Regenerate evidence and copy from
   the frozen commit.
4. Treat Move 07 as opportunistic. A blocked SAIA entitlement must not delay the
   core submission.
5. If time runs short, cut Move 05 before cutting correctness, public evidence,
   submission truth, video compliance, or clean-room QA.

## Explicitly Rejected Work

- Full CLI decomposition before the deadline.
- Browser entry or transport of Splunk/Gemini credentials.
- Exposing arbitrary CLI commands or output paths over HTTP.
- UI waivers, client-side score recalculation, or receipt mutation.
- LLM-generated violations or semantic scoring.
- A second generic Gemini explanation layer.
- Automated Splunk index, app, saved-search, or event mutation.
- Destructive branch cleanup.
- Claims of an installable SDK, reusable GitHub Action, or successful live SAIA
  invocation without evidence.

These are not blanket rejections forever. They are poor choices for the current
deadline or conflict with locked product decisions.

## Definition Of Done For Each Move

Each move must:

1. Follow `AGENTS.md`, the current wave contract, and locked decisions.
2. State expected files before editing and keep changes inside its scope.
3. Add focused regression coverage for changed behavior.
4. Run every listed verification command and record exact results.
5. Update execution and verification logs for implementation waves.
6. Stop when a listed stop condition is reached.
