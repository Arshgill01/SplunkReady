# Antigravity UI Concepts 21:10 Triage

Wave: 81 - Forensic Compiler Dossier UI

Sidecar:

- Worktree: `/private/tmp/splunkready-antigravity-ui-concepts-20260601-211055`
- Branch: `antigravity-ui-concepts-20260601-211055`
- tmux window: `Splunk:5` / `agy-ui-concepts-2110`
- Model: Gemini 3.5 Flash High through Antigravity

## Requested Brief

Ask the sidecar for 3-4 fresh, non-generic UI concepts for the static Readiness Receipt and certification replay. The brief explicitly rejected chatbot, copilot, MCP telemetry dashboard, detection-health dashboard, generic eval harness, fake live execution, KPI grids, glassmorphism, purple gradients, decorative orbs, assistant transcripts, and unbacked claims.

## Sidecar Output

The sidecar produced three concepts:

- `concept-1-audit-ledger.html`: compliance-native ledger style.
- `concept-2-forensic-casefile.html`: security-native casefile timeline.
- `concept-3-compiler-diagnostics.html`: developer-native compiler diagnostics.

It recommended a hybrid named "Forensic Compiler Workbench": Concept 2's case timeline structure with Concept 3's compiler-style diagnostics and some Concept 1 audit framing.

## Main Executor Triage

Accepted:

- Use a left-side case timeline for the `Fail -> Rules -> Patch -> Rerun -> Pass` replay.
- Add deterministic compiler diagnostics in the Rules phase using real `Violation` data.
- Keep all UI claims backed by loaded receipt, trace, violation, policy patch, and evidence artifacts.
- Preserve the static shell and existing artifact loading path.

Rejected:

- Do not copy sidecar prototypes into the main tree.
- Do not introduce fake commands such as `splc` or any fake executable claim.
- Do not hardcode sample receipt ids, "7 checks", sample result counts, or pass/fail text from the prototypes.
- Do not add dark SaaS glass, animated live telemetry, fake charts, or assistant transcript patterns.
- Do not rename the product artifact away from Readiness Receipt.

## Integrated Scope

The integrated UI is a bounded artifact-backed "Forensic Compiler Dossier" treatment inside `renderCertificationReplay`.

It keeps the current shell generator and tests, while changing the replay interaction from generic horizontal tabs to a case timeline with compiler diagnostics such as `error[SPL-001]` rendered from actual violation rule ids, severities, trace event ids, evidence JSON, reasons, and suggested policy patches.

No schema, adapter, grader, or CLI behavior changed.
