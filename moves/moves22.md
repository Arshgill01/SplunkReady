# Move 22 - Finalize README, Devpost, And Root Architecture

## Goal

Make the public repository and Devpost submission accurate, rules-compliant, and
grounded in the evidence pack.

## Scope

Expected files:

- `README.md`
- `docs/devpost-submission.md`
- root `architecture_diagram.md`, `.pdf`, or `.png`
- claim ledger from Move 21
- stale status docs only where they contradict final truth
- logs

## Plan

1. Add the required root architecture diagram showing Splunk interaction,
   agent/model integration, compiler, grader, receipt, backend, and UI.
2. Rewrite README opening around SplunkReady as an interactive certification
   workbench plus deterministic receipt engine.
3. Keep the Platform & Developer Experience track explicit.
4. Treat Security as the flagship use case, not a separate track prize.
5. Describe the workbench, fixture demo, live MCP proof, external trace path,
   policy/firewall flow, and evidence pack.
6. Rewrite Devpost copy against the four judging criteria.
7. Mark SAIA as proven only if Move 09 produced successful evidence.
8. Remove unsupported probability, performance, SDK, or "all claims" language.

## Acceptance Criteria

- Root architecture file exists in an officially accepted filename.
- README quickstart works.
- Devpost copy has no stale live/SAIA/security-prize claim.
- Every important claim links to Move 21 evidence or is clearly conditional.

## Verification

```bash
npm run audit:submission-copy
npm run audit:reviewers
npm run check
git diff --check
```

Manually inspect the rendered diagram and all public links.

## Stop Conditions

- Stop before turning future work into present-tense evidence.
- Stop before claiming multiple mutually exclusive prizes as targets.
- Stop before claiming live hosted-model success without proof.
