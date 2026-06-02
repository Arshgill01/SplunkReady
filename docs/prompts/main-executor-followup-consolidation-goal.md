# Main Executor Follow-up Consolidation `/goal` Prompt

Use this prompt for the main implementation agent after the Day 1 SplunkReady build pass. This is not a fresh-start build prompt. It is a consolidation, truth-audit, and blocker-closure prompt.

~~~text
/goal

You are the main executor for SplunkReady.

Objective:
Stabilize the Day 1 SplunkReady build, close the current dirty wave state, and produce evidence-backed clarity about what is real, what is fixture-only, and what is still live-unverified. Do not start another wave treadmill. The immediate job is consolidation and proof, not feature churn.

Do not mark this goal complete unless the user explicitly gives the green light.

Product lock:
- Product name: SplunkReady.
- Tagline: Certify AI agents before they touch production Splunk.
- Engine: Agent Readiness Compiler.
- Primary artifact: Readiness Receipt.
- Submission track: Platform & Developer Experience.
- Flagship story: security investigation readiness.

Current known audit state:
- Branch should be splunkready-build.
- Day 1 produced real code: CLI, fixture adapter, live adapter skeleton, compiler, deterministic grader, specimen agent, receipts, policy patch, static UI, fixtures, tests, scripts, docs, and logs.
- Previous audit found roughly 27 src files, 31 tests, 7 fixture files, 141 docs, 192 logs, and 3 scripts. Recount if you need current numbers.
- Previous validation passed: npm test, npm run check, npm run verify:scaffold, git diff --check.
- Previous reviewer audit failed because a Wave 81 reviewer verdict was fail. There may now be newer Wave 81 resolution/rereview files; inspect current state rather than assuming the old failure still applies.
- Real Splunk had not been touched in the audited state. Live smoke was skipped without credentials/env. Do not imply otherwise unless you produce exact live evidence.
- The highest product-risk gap is that NaiveSpecimenAgent may be deterministic/demo-shaped rather than a real naive LLM/MCP agent. Handle this honestly.

Hard rules:
- Do not pretend live Splunk validation happened.
- Do not claim a real LLM/MCP specimen agent exists unless it truly exists and is exercised.
- Do not use an LLM as the authoritative pass/fail grader.
- Do not auto-mutate Splunk.
- Do not expose or commit secrets.
- Do not begin Wave 82 or any new wave until Wave 81/current dirty state is understood and closed.
- Do not leave a claimed-complete consolidation with a dirty worktree, failing reviewer audit, or unrun verification.
- Do not delete or revert unrelated user/agent work casually. If you must discard current work, justify it and make the action reviewable.

Required first commands:
Run these before deciding what to fix:

```bash
git branch --show-current
git status --short
git log --oneline --decorate --max-count=12
npm run audit:reviewers
npm run check
git diff --check
```

Also inspect:

```bash
ls docs/prompts
ls logs/reviewer-inbox | tail -40
rg -n "Wave 81|wave-81|reviewer|verdict|fail|pass|live Splunk|real Splunk|NaiveSpecimenAgent|fixture-only|live-smoke" docs logs src tests README.md MANIFEST.md PLAN.md
```

Primary work sequence:

1. Close the current wave state.
   - Determine whether Wave 81 is actually unresolved, resolved but uncommitted, or obsolete.
   - Read the latest relevant reviewer inbox files, including any Wave 81 main-resolution and rereview files.
   - If the Wave 81 work is valid, finish its verification and commit it.
   - If the Wave 81 work is invalid or distracting, create a reviewable rollback/cleanup plan and execute only if safe.
   - Do not start new product work until this is clean.

2. Restore reviewer audit trust.
   - Make `npm run audit:reviewers` pass, or document the exact remaining failing file and why it cannot be resolved in this pass.
   - Do not bury a failing reviewer verdict under new docs.
   - The latest reviewer signal must be understandable from logs and command output.

3. Make build/dist state intentional.
   - Run `npm run build` if source or UI changed since the tracked build artifacts.
   - Determine whether `dist` is tracked and expected to be updated.
   - If `dist` is tracked, update it intentionally and include it in the correct commit.
   - If `dist` is not tracked, document that source is authoritative.
   - Do not leave stale generated artifacts silently.

4. Produce live Splunk/MCP proof or an explicit proof gap.
   - Attempt only bounded, read-only live proof if env vars/credentials are available.
   - The acceptable live probe scope is read-only: get info, indexes, metadata, knowledge objects, and saved-search availability if supported.
   - If no live credentials are available, produce an explicit proof-gap document such as `docs/live-proof-gap.md` with:
     - exact env vars/config missing;
     - exact command run;
     - exact skip/failure output;
     - the smallest next command needed once credentials exist.
   - Never imply real Splunk was touched if the live path skipped.

5. Address the specimen-agent credibility risk.
   - Inspect `NaiveSpecimenAgent` and the trace generation path.
   - Decide whether to implement a real external/model-driven naive agent trace path in this pass, or to explicitly downgrade claims and document current specimen limitations.
   - If implementing, keep it bounded and testable.
   - If not implementing, add a concrete next-step plan and ensure docs/demo language says deterministic demo specimen, not real naive LLM agent.
   - The grader may remain deterministic; LLMs may summarize/explain, not decide pass/fail.

6. Reduce fixture-overfit risk.
   - Verify whether missions beyond the flagship `win-finance-07` story are represented and tested, especially prompt injection, saved-search discipline, app context, evidence grounding, query-budget refusal, and at least one observability transfer mission.
   - Add a small matrix/report if the coverage already exists.
   - Add one minimal fixture/mission/test only if the current suite is genuinely too narrow.
   - Do not bloat the product with fake breadth.

7. Produce a consolidation report.
   - Create or refresh a concise report such as `docs/day-1-consolidation-audit.md` or `docs/follow-up-gap-closure-report.md`.
   - It must separate:
     - real implemented capabilities;
     - fixture-only capabilities;
     - live-unverified capabilities;
     - deterministic specimen limitations;
     - tests/checks that passed;
     - checks that failed or were skipped;
     - unresolved reviewer findings;
     - highest-leverage next tasks.
   - Use exact command strings and results.

8. Commit exactly one clean consolidation wave if feasible.
   - Suggested commit message: `wave-82: consolidate day-one build state`.
   - Commit only after checks pass and reviewer audit status is clean or explicitly documented.
   - If you cannot commit, explain the exact blocker and leave the tree as clean as possible.

Required closeout commands:
Run the narrowest relevant commands first, then the broad checks:

```bash
npm run audit:reviewers
npm run check
git diff --check
git status --short
```

If source or build artifacts changed, also run:

```bash
npm run build
```

If live credentials are unavailable, run the fixture/live skip proof explicitly, for example:

```bash
unset SPLUNKREADY_LIVE_ENABLED SPLUNKREADY_SPLUNK_MCP_URL SPLUNKREADY_SPLUNK_MCP_TOKEN SPLUNK_HOST SPLUNK_TOKEN SPLUNK_USERNAME SPLUNK_PASSWORD SPLUNK_SCHEME SPLUNK_PORT
npm run splunkready -- live-smoke --out /tmp/splunkready-live-smoke-gap
```

Stop conditions:
- Stop and report if reviewer audit cannot pass because of unresolved real findings.
- Stop and report if live proof requires credentials you do not have.
- Stop and report if current dirty changes conflict in a way that would require deleting uncertain work.
- Stop and report if you discover the product docs make materially false claims about live Splunk or real agents.

Final response contract:
- What changed.
- Commands run, exactly.
- Pass/fail status.
- Open risks.
- Current commit hash if you made a commit.
- Whether the tree is clean.
~~~
