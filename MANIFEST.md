# SplunkReady Scaffold Manifest

Status: implemented through Wave 67 continuation QA on `splunkready-build`.

This repository turns the locked SplunkReady idea into an implemented, fixture-first certification harness with continuing wave-based QA. The scaffold process remains in force for future continuation waves.

## Product Lock

- Product: SplunkReady
- Tagline: Certify AI agents before they touch production Splunk.
- Engine: Agent Readiness Compiler
- Primary artifact: Readiness Receipt
- Submission track: Platform & Developer Experience
- Flagship demo story: security investigation readiness

## Required Reading Order

1. `AGENTS.md`
2. `PLAN.md`
3. `DECISIONS.md`
4. `ARCHITECTURE.md`
5. `QUALITY-BAR.md`
6. `docs/grader-rule-catalog.md`
7. `docs/fixture-live-parity.md`
8. `docs/golden-traces.md`
9. `docs/demo-script.md`
10. `docs/prompts/README.md`
11. `docs/prompts/main-executor-goal.md`
12. `docs/prompts/reviewer-goal.md`
13. `docs/waves/README.md`
14. Current wave file under `docs/waves/`
15. `logs/reviewer-inbox/README.md`
16. `logs/risk-register.md`

## Directory Map

- `docs/waves/`: wave-by-wave execution plan.
- `docs/waves/WAVE-CONTRACT.md`: global contract every wave must follow.
- `docs/reviewer/`: read-only reviewer loop instructions.
- `docs/schemas/`: canonical schema contracts for implementation.
- `docs/skills/`: local workflow skills future agents should create or follow.
- `docs/stack-recommendation.md`: historical Wave 02 stack recommendation superseded by `docs/stack-decision.md`.
- `docs/verification-matrix.md`: current scaffold and implementation verification evidence.
- `docs/grader-rule-catalog.md`: deterministic rule IDs and pass/fail boundaries.
- `docs/golden-traces.md`: reference failure/pass traces for future tests and demo.
- `docs/fixture-live-parity.md`: fixture/live adapter parity contract.
- `docs/demo-script.md`: 3-minute final demo script.
- `docs/prompts/`: copy-paste `/goal` prompts for the main executor and reviewer.
- `references/source-grounding-matrix.md`: source evidence for major claims.
- `logs/`: living logs for execution, review, risks, decisions, and verification.
- `logs/reviewer-inbox/`: unique reviewer findings files written by the reviewer loop.
- `references/`: source context and pointers to prior research in `../Splunk/research`.
- `scripts/`: scaffold verification scripts.

## Completion Gate

The implementation is not done until:

- fixture and live modes share the same interfaces;
- deterministic grader covers the core failure modes;
- naive specimen agent is real, not scripted;
- Readiness Receipt contains trace/evidence provenance;
- demo loop shows fail -> compile -> patch -> rerun -> pass;
- verification commands pass and are logged.
