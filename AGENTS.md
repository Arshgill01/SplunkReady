# AGENTS.md

This file governs future agents working inside `SplunkReady`.

## Mission

Build SplunkReady: a Splunk-native certification harness that proves whether an AI agent is safe and correct enough to operate on a specific Splunk deployment.

The product is not a Splunk chatbot, SOC copilot, telemetry dashboard, or detection-health dashboard.

## Non-Negotiables

- Product name is `SplunkReady`.
- Engine name is `Agent Readiness Compiler`.
- The key output is the `Readiness Receipt`.
- Fixture mode and live mode must share the same internal interfaces.
- Trace grading must be deterministic wherever possible.
- LLMs may explain, summarize, and draft policy patches; they must not be the primary pass/fail judge.
- The specimen agent must be real but naive, not hardcoded to fail/pass.
- The app must not auto-mutate Splunk.
- Real Splunk integration work is allowed and encouraged when it is explicit,
  operator-scoped, and verified against fixture/live parity. Read-only live
  probes are preferred. Write/install/setup operations against a Splunk
  deployment require an explicit command, clear blast radius, and evidence log;
  they must never run as a hidden side effect of a default proof.
- Do not claim SplunkReady invents MCP telemetry or rate limiting.
- Security is the flagship story; Platform & Developer Experience is the submission track.

## Work Model

Use a single main executor for implementation.

Use a mostly read-only reviewer loop:

- reviewer inspects the current wave;
- reviewer runs allowed checks;
- reviewer writes unique finding files to `logs/reviewer-inbox/`;
- main executor resolves or explicitly waives findings.

Parallel implementation agents are allowed only for bounded, non-overlapping file ownership.

## Required Process

Before editing source code in a future implementation phase:

1. Read `MANIFEST.md`, `PLAN.md`, `DECISIONS.md`, `ARCHITECTURE.md`, and `QUALITY-BAR.md`.
2. Read the current wave file.
3. Check `logs/reviewer-inbox/` and `logs/risk-register.md`.
4. State the files you expect to touch.
5. Implement only the current wave's scope.
6. Run the current wave's verification commands.
7. Update `logs/execution-log.md`.
8. Update `logs/verification-log.md`.

## Branch And Commit Model

- Main executor uses one long-running branch: `splunkready-build`.
- Main executor makes one commit per completed wave by default.
- Reviewer does not commit.
- Sidecar agents use separate worktrees/branches for bounded work.
- Antigravity/Gemini may be launched with `agy --dangerously-skip-permissions` only from a clean side worktree/branch unless the user explicitly approves otherwise.

## Stop Conditions

Stop and ask before:

- changing product scope;
- making LLM scoring authoritative;
- bypassing fixture/live interface parity;
- adding a heavy dependency;
- changing the demo trap set;
- removing deterministic checks;
- introducing implicit write operations against Splunk. Explicit
  operator-approved live setup, app installation, or receipt-store population
  is allowed only when documented, reversible, and not part of the default
  credential-free judge path.

## Style

- Keep names boring and descriptive.
- Prefer small explicit modules over vague abstractions.
- Preserve traceability from code to schema to receipt.
- Every important UI claim must be backed by contract, trace, or violation data.
