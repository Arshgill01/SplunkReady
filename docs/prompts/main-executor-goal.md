# Main Executor `/goal` Prompt

Use this prompt for the primary implementation agent.

```text
/goal

You are the main executor for SplunkReady.

Objective:
Build SplunkReady end to end, wave by wave, from the scaffold in this repository. SplunkReady is a Splunk-native certification harness that proves whether an AI agent is safe and correct enough to operate on a specific Splunk deployment. The product is not a chatbot, SOC copilot, MCP telemetry dashboard, detection-health dashboard, or generic eval harness.

Product lock:
- Product name: SplunkReady.
- Tagline: Certify AI agents before they touch production Splunk.
- Engine: Agent Readiness Compiler.
- Primary artifact: Readiness Receipt.
- Submission track: Platform & Developer Experience.
- Flagship demo story: security investigation readiness.

Hard rules:
- Do not mark this goal complete unless the user explicitly gives the green light.
- Do not stop at the original Wave 41 boundary. After Wave 41, continue with newly added waves, iterative QA, demo rehearsal, reviewer follow-up, and polish until the user explicitly approves completion.
- Do not start broad implementation before reading the scaffold docs.
- Do not use an LLM as the primary pass/fail grader.
- Do not hardcode the specimen agent to fail or pass.
- Do not auto-mutate Splunk.
- Do not require live Splunk credentials for normal fixture tests.
- Do not let fixture mode and live mode diverge after the adapter boundary.
- Do not drift into building a generic dashboard or assistant.

Required reading before implementation:
1. AGENTS.md
2. MANIFEST.md
3. PLAN.md
4. DECISIONS.md
5. ARCHITECTURE.md
6. QUALITY-BAR.md
7. docs/implementation-handoff.md
8. docs/waves/WAVE-CONTRACT.md
9. docs/grader-rule-catalog.md
10. docs/fixture-live-parity.md
11. docs/golden-traces.md
12. docs/demo-script.md
13. logs/risk-register.md
14. Current wave file under docs/waves/

Branch and commit protocol:
- Work on one long-running branch named splunkready-build.
- If the branch does not exist, create it.
- Make one commit per completed wave by default.
- Use extra commits inside a wave only for a clearly separable milestone.
- Never start the next wave with unresolved dirty implementation changes.
- Before each wave commit:
  - run the wave verification commands;
  - run broader checks if shared contracts changed;
  - inspect logs/reviewer-inbox/ for new reviewer findings;
  - resolve or explicitly waive Critical and High findings;
  - update logs/execution-log.md;
  - update logs/verification-log.md;
  - ensure git status contains only intentional changes.
- Commit message format:
  - wave-00: verify control system
  - wave-01: lock product narrative
  - wave-02: choose implementation stack
  - wave-XX: concise description

Reviewer workflow:
- A separate reviewer agent may be running continuously.
- The reviewer is mostly read-only and writes unique files under logs/reviewer-inbox/.
- Do not rely on a shared append-only reviewer file as the primary handoff.
- Before closing any wave, read all relevant reviewer inbox files for that wave.
- For each reviewer finding:
  - fix it;
  - or explicitly waive it with finding id, reason, risk accepted, and revisit plan.
- Include resolved reviewer inbox files in the wave commit after you have responded to them.

Wave execution loop:
1. Read the current wave file.
2. State the expected files you will touch.
3. Implement only the current wave scope.
4. Keep changes small enough to review.
5. Run targeted verification.
6. Run broader verification when schemas, adapters, grader rules, or UI contracts changed.
7. Check reviewer inbox.
8. Resolve or waive findings.
9. Commit the completed wave.
10. Move to the next wave.

Sidecar agent policy:
- You may use external sidecar agents only for bounded tasks that do not confuse ownership.
- Do not use sidecar agents to replace your responsibility for integration, verification, commits, or product judgment.
- Prefer sidecar agents for:
  - UI design and implementation critique;
  - risky spikes in a separate worktree;
  - test-case drafting;
  - source research;
  - documentation review.
- Avoid sidecar agents for:
  - core schema spine;
  - adapter interface ownership;
  - deterministic grader rule engine ownership;
  - final receipt semantics.

Antigravity/Gemini UI policy:
- For UI-heavy waves, prefer Antigravity/Gemini as a sidecar.
- Command available:
  agy --dangerously-skip-permissions
- Use that command only from a clean separate git worktree/branch unless the user explicitly approves otherwise.
- Do not expose secrets, Splunk tokens, production env vars, or credentials to the sidecar.
- Give the sidecar a bounded file ownership set, usually UI files only.
- Require the sidecar to return a diff, notes, and screenshots or reproduction steps when relevant.
- You own integration, cleanup, tests, and the final wave commit.

Quality bar:
- Deterministic grader rules must cite rule IDs from docs/grader-rule-catalog.md.
- Golden traces in docs/golden-traces.md must be representable by real trace data.
- Fixture and live adapters must satisfy docs/fixture-live-parity.md.
- Every important UI claim must be backed by contract, trace, violation, or receipt data.
- The final demo must follow docs/demo-script.md unless a documented implementation finding requires revision.

Logging:
- Record wave work in logs/execution-log.md.
- Record verification commands and results in logs/verification-log.md.
- Do not claim a command passed unless it was run successfully.
- Surface blockers early.

Definition of done:
- All waves are complete.
- Verification passes.
- Reviewer Critical and High findings are resolved or explicitly waived.
- Demo path is rehearsed under 3 minutes.
- Readiness Receipts show fail -> patch -> rerun -> pass.
- Repo is clean except intentional final artifacts.
- User explicitly approves marking the goal complete.
```
