# Implementation Handoff

## Current State

SplunkReady is implemented through Move 106 on the long-running `splunkready-build` branch. The build includes the fixture-first certification flow, deterministic grader, Readiness Receipts, policy patch and rerun path, optional read-only live smoke path, reviewer audit automation, submission guardrails, external trace grading through `grade-trace`, deployment-bound `readiness-profile.json` artifacts, explicit live-proof gap documentation, Vite artifact workbench, published npm CLI, GitHub Pages public demo, MCP resources/prompts/composition proof, refreshed submission evidence, remote cleanroom proof, and live-security public-export redaction coverage.

Current pushed head at this handoff refresh:

- Commit: `72e2839c41ec4a650130967701c34856aead41ff`
- Branch: `splunkready-build`
- Hosted CI: run `27087842901`, `npm run check`, success
- Remote cleanroom report: `docs/remote-cleanroom-after-hosted-copy-report.md`
- Published package smoke: `npx -y splunkready@0.1.0 judge-proof --out ./judge-proof --json`
- Hosted MCP proof: `https://arshgill01.github.io/SplunkReady/?artifacts=artifacts%2Fmcp-proof#mcp-proof`
- Hosted judge proof: `https://arshgill01.github.io/SplunkReady/?artifacts=artifacts%2Fjudge-proof#proof-browser`

## Start Here

Future continuation agents should begin with:

1. `AGENTS.md`
2. `PLAN.md`
3. `DECISIONS.md`
4. `ARCHITECTURE.md`
5. `QUALITY-BAR.md`
6. `docs/waves/WAVE-CONTRACT.md`
7. the latest wave file under `docs/waves/`

## Implementation Decisions Already Made

Wave 02 selected the implementation stack. Current core choices:

- TypeScript is the implementation language.
- Runtime schema validation is mandatory.
- Fixture mode runs without Splunk credentials.
- UI work follows the schema, grader, receipt, and artifact spine. The primary judge UI is now the Vite artifact workbench; the generated static shell remains a fallback artifact.

## Main Executor Rule

The main executor owns implementation. Reviewer is read-only unless explicitly assigned a tiny, bounded patch.

The main executor uses one long-running branch named `splunkready-build` and makes one commit per completed wave by default.

## Parallelism Rule

Parallelize:

- review;
- docs audit;
- source research;
- UI critique;
- test-case drafting.

Use Antigravity/Gemini with `agy --dangerously-skip-permissions` only as a bounded sidecar from a clean side worktree/branch unless the user explicitly approves otherwise.

Do not parallelize:

- schema spine;
- adapter interface;
- grader rule engine;
- receipt schema.

## Next Concrete Step

Continue with the next narrow product wave. The highest-leverage remaining work is either stronger MCP-category public evidence around existing Splunk MCP plus SplunkReady certification, or an operator-approved redacted live-security proof export. Do not read or commit ignored live artifacts or secret env files unless the operator explicitly asks for that export path. Start from a clean `splunkready-build` checkout, read the latest move file, check `logs/reviewer-inbox/`, then run the move-specific verification. The current broad health check is:

```bash
npm run check
```

Then record the exact result in `logs/verification-log.md`.
