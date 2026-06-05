# SplunkReady Development Moves

Prepared: 2026-06-04

This is the revised, code-focused execution plan for SplunkReady. It keeps the
correctness findings from the review, but it no longer treats submission
paperwork as first-class engineering work. The product needs a real operator
workbench: a local backend, executable UI workflows, live proof actions, artifact
management, and enough CLI extraction to make that safe.

## Operating Thesis

SplunkReady should demo as an **interactive certification workbench**, not as a
static reader wrapped around a CLI. The UI must be able to start a fixture
certification, watch the fail-to-pass loop, inspect receipts, run server-env live
checks, certify external traces, and browse proof bundles.

The backend remains local and operator-owned. It may read server-side env vars
for live mode. The browser must not submit Splunk tokens, Gemini keys, arbitrary
commands, or filesystem paths.

## Priority Map

| Priority | Move | Estimate | Why |
|---|---|---:|---|
| P0 | [01](moves01.md) Fail closed on missing rules | 0.5-1d | Certification cannot silently skip checks. |
| P0 | [02](moves02.md) Implement missing activated rules | 1.5-3d | Catalog must match runtime. |
| P0 | [03](moves03.md) Fixture/live parity and fixture drift | 0.5-1d | Trust boundary must hold. |
| P0 | [04](moves04.md) Workflow extraction | 1-2d | Backend/UI need reusable orchestration. |
| P0 | [05](moves05.md) Local workbench backend | 1-2d | Turns UI from reader into app. |
| P0 | [06](moves06.md) Job runner and artifact store | 1-2d | Makes executions observable and safe. |
| P0 | [07](moves07.md) Executable fixture certification UI | 1.5-2.5d | Demo-critical interactive fail-to-pass loop. |
| P1 | [08](moves08.md) Live readiness/proof actions | 1-2d | Shows real Splunk MCP from UI without browser secrets. |
| P1 | [09](moves09.md) SAIA hosted-model workflow | 0.5-1d | Conditional but valuable. |
| P1 | [10](moves10.md) External trace and transcript certification UI | 1-2d | Platform & DevEx story. |
| P1 | [11](moves11.md) Proof bundle browser and comparison | 1-2d | Makes receipts and audits inspectable. |
| P1 | [12](moves12.md) Policy patch and firewall workbench | 1-2d | Shows how failures become safer reruns. |
| P1 | [13](moves13.md) Live security kit UX, no mutation | 0.5-1d | Reduces live demo friction safely. |
| P1 | [14](moves14.md) Certification index from the workbench | 0.5-1d | Multi-proof ledger visible in UI. |
| P2 | [15](moves15.md) CLI modularization around reused workflows | 1-2d | Shrinks monolith where it matters. |
| P2 | [16](moves16.md) Browser and API test harness | 1-2d | Prevents regressions in the new app surface. |
| P2 | [17](moves17.md) Canonical verification gate | 0.5-1d | Keeps fast-moving work honest. |
| P2 | [18](moves18.md) Dependency advisory cleanup | 0.5d | Removes critical dev audit result. |
| P2 | [19](moves19.md) Public proof export | 0.5-1d | Lets UI emit sanitized bundles. |
| P3 | [20](moves20.md) Workbench packaging and run command | 0.5-1d | One command to launch the real demo app. |
| P0 | [21](moves21.md) Submission evidence pack | 0.5-1d | Produces tracked proof judges can inspect. |
| P0 | [22](moves22.md) README, Devpost, and root architecture | 0.5-1d | Makes public claims match evidence. |
| P0 | [23](moves23.md) Public demo video and feedback form | 0.5-1d | Required submission artifacts stay accountable. |
| P0 | [24](moves24.md) Clean-room submission gate | 0.5d | Final judge-path verification. |
| P0 | [25](moves25.md) Consolidate workbench UI surface | 0.5d | Keeps the final judge path clear without hiding proof instrumentation. |
| P0 | [26](moves26.md) Remote clean-room gate and cleanup backlog | 0.5d | Proves the pushed branch works from a fresh clone and records final cleanup work. |
| P0 | [27](moves27.md) Run browser module boundary | 0.5d | Keeps the Runs proof-browser maintainable while preserving live UI evidence. |
| P0 | [28](moves28.md) Browser health path privacy | 0.5d | Prevents browser-visible workbench health from exposing local filesystem paths. |
| P0 | [29](moves29.md) Workbench route error redaction | 0.5d | Applies the same secret redaction boundary to route-level API failures. |
| P0 | [30](moves30.md) Workbench response security headers | 0.5d | Adds conservative browser hardening headers to local API and UI responses. |
| P0 | [31](moves31.md) Workbench server fallback redaction | 0.5d | Redacts server-level fallback errors before they reach the browser. |
| P0 | [32](moves32.md) Workbench no-store responses | 0.5d | Prevents browser caching of local proof and workbench responses. |
| P0 | [33](moves33.md) Runs trace preview timeline | 0.5d | Makes the Runs trace panel show compact ordered events instead of summary-only cards. |
| P0 | [34](moves34.md) SplunkReady secret env ignore | 0.5d | Ensures `.splunkready*` local secret files are ignored by default. |
| P0 | [35](moves35.md) Secret env ignore gate | 0.5d | Adds the `.splunkready*` and `.env*` ignore boundary to the canonical check. |
| P0 | [36](moves36.md) Local artifact base guard | 0.5d | Keeps browser artifact loading on local paths even if query parameters or manifests provide URL-like bases. |
| P0 | [37](moves37.md) Workbench cross-site API guard | 0.5d | Rejects browser-marked cross-site requests before they can start local workbench workflows. |
| P0 | [38](moves38.md) Isolated workbench job snapshots | 0.5d | Keeps public job reads from exposing mutable runner-owned job state. |
| P0 | [39](moves39.md) Atomic workbench job limit | 0.5d | Reserves a job slot before async run allocation so concurrent starts cannot exceed the configured limit. |

## Non-Negotiable Boundaries

- Deterministic rules remain authoritative for verdicts and scores.
- LLMs and SAIA may explain, optimize, and advise; they do not grade.
- SplunkReady does not auto-mutate Splunk.
- Browser clients never submit secrets or arbitrary shell commands.
- The backend allowlists workflows; it is not a generic CLI-over-HTTP wrapper.
- Fixture and live mode keep shared internal interfaces.
- Policy patches are proposed additions for review, not hidden auto-application.

## Cut Order

If time gets tight, cut in this order:

1. Move 20 packaging polish.
2. Move 15 broader CLI modularization.
3. Move 14 certification-index UI.
4. Move 13 live-kit UX.
5. Move 12 firewall/policy workbench.
6. Move 09 SAIA if entitlement is blocked.

Do not cut Moves 01-07 or 21-24. Moves 01-07 are the minimum credible
interactive product; Moves 21-24 are the minimum credible submission package.
