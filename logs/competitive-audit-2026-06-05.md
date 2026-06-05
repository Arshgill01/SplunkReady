# Competitive Audit - 2026-06-05

Source: user-provided critical audit during the autonomous hardening pass.

## User Audit Summary

The project should not assume the historical confidence percentages are
competition-realistic. Under a critical judging panel, the user estimates lower
competitive win probabilities:

- Platform & Developer Experience: historical 92%, competitive reality closer
  to 65% because certification and policy compliance can feel like operational
  friction unless SplunkReady clearly accelerates developer workflow.
- Best Use of MCP Server: historical 88%, competitive reality closer to 45%
  because SplunkReady originally consumed MCP-style traces more than proving a
  useful MCP server.
- Developer Tools: historical 85%, competitive reality closer to 55% because a
  fresh judge may abandon the project if they must clone, install, discover CLI
  commands, and run a local Express/Vite server instead of testing one obvious
  path.

Critical vulnerabilities called out:

- The flagship security scenario can be fixture-only unless the live Splunk
  instance contains the expected `wineventlog` / Enterprise Security saved
  search data. A fresh trial may fall back to `_internal` and make the security
  narrative look weak or trivial.
- Deterministic grading can look boring in a modern AI hackathon, even though it
  is the correct enterprise safety posture.
- Native agent integrations are still a risk if framework users must manually
  shape traces instead of using familiar callbacks, middleware, CI hooks, or MCP
  clients.

User concern: the deterministic rules angle has felt uncertain from the
beginning, so the product must prove that deterministic pass/fail is a strength,
not a lack of AI capability.

## Main Executor Response

Keep deterministic pass/fail authority. Do not convert readiness into
LLM-judging-LLM. Instead:

- make deterministic grading feel like a compiler contract with visible rule
  activation, evidence refs, receipt provenance, and advisory LLM/SAIA
  explanations;
- keep the strict live-security boundary honest so generic `_internal` live
  proof cannot masquerade as the flagship security proof;
- reduce setup friction with a one-command judge proof, composite GitHub Action,
  job summaries, MCP server proof, and package-style CLI execution;
- add integration helpers that let external agents and frameworks emit canonical
  traces without depending on heavyweight framework packages.

## Moves Already Addressing This Audit

- Move 45: dependency-free callback trace capture.
- Move 46: one-command MCP server proof.
- Move 47: strict live-security readiness contract with fallback disallowed.
- Move 48: composite GitHub Action gate.
- Move 49: GitHub Action job summary.
- Move 50: local package CLI bin plus bundled default input resolution.
- Move 51: suite compiler diagnostics that turn deterministic rules into a
  visible activation/resolution report backed by readiness profiles, receipts,
  traces, and violation files.
- Move 52: GitHub Action `diagnostics-path` output and job-summary row so CI
  users can find the compiler evidence without knowing the artifact tree.

## Remaining Considerations

- Final UI consolidation should reduce surface overload without removing
  verification affordances that are still useful during testing.
- A registry-published package is still a strategic option, but it should not be
  claimed until publishing, package contents, install lifecycle, and default
  asset resolution are verified.
- Framework-specific adapters should remain thin and dependency-light unless
  there is strong evidence that a heavy integration materially improves judge or
  developer workflow.

## Minimax 3 Audit Addendum

Source: user-provided Minimax 3 read-only audit during the same hardening pass.

### Current State Claims To Consider

- The core engine is strong: fixture/live adapter parity, deterministic rules,
  Readiness Receipts, no Splunk auto-mutation, and the live security proof path
  are real engineering strengths.
- Internal quality confidence should be scored lower than earlier optimistic
  numbers if stale submission evidence, private package status, and missing
  public demo access are counted honestly.
- The audit estimates the project is capped more by shipping friction than by
  engine weakness: judges cannot currently run `npx splunkready`, click a hosted
  workbench, or inspect a refreshed evidence pack containing the latest moves.
- The deterministic-rules posture should be protected, but the presentation must
  continue making it feel like compiler-grade proof rather than a plain static
  rule table.

### High-Leverage Follow-Ups

- Prepare for public package installation, but do not publish silently. Actual
  npm publication changes the release surface and needs an explicit release
  decision.
- Prepare for a hosted workbench path, but do not deploy silently. External
  hosting should be a separate release action with clear artifact and redaction
  boundaries.
- Refresh the tracked submission evidence after the latest workbench, MCP proof,
  GitHub Action, compiler diagnostics, and strict live-security readiness work.
- Add an in-repo CI workflow that exercises the canonical gate, so the composite
  action is not only documented but also backed by a visible green path.
- Add MCP resources and prompts if targeting Best Use of MCP, while preserving
  the certification-only scope and avoiding Splunk write tools.
- Revisit CLI modularization around reused workflow modules because
  `src/cli.ts` is still the clearest production-maintainability debt.
- Capture the official hackathon judging criteria in a tracked document before
  treating any probability table as calibrated.

### Immediate Move Response

Move 55 addresses one concrete native-integration gap from this audit by
exposing stable package subpaths and generated declarations for the trace bridge,
callback capture helper, and schema imports. It does not claim public npm
publication.

Move 56 addresses the in-repository CI visibility gap by adding a credential-free
GitHub Actions workflow for the canonical `npm run check` gate. It does not
claim a green badge until GitHub has actually run the workflow.

Move 57 follows up on the first hosted CI run by installing ripgrep before the
canonical gate; the prior run failed in `scripts/verify-scaffold.sh` because
`rg` was missing on the GitHub runner.
