# Move 12 - Add Policy Patch And Firewall Workbench

## Goal

Make the safety loop visible: unsafe agent behavior creates deterministic
violations, violations produce proposed policy additions, and rerun/firewall
checks enforce safer behavior.

## Scope

Expected files:

- workflow extraction for firewall check and policy-backed rerun if needed
- backend jobs for firewall checks
- UI policy patch and firewall panels
- tests
- logs

## Plan

1. Render policy patches as proposed additions with violation mapping.
2. Show that patches are exported for review and are not applied to Splunk.
3. Add **Run policy-backed rerun** action where the workflow supports it.
4. Add firewall-check action for compiled policy.
5. Show blocked SPL examples and the specific rule/policy boundary that blocked
   them.
6. Add clear mutation posture display.
7. Keep all verdict/score data from receipts, not UI recalculation.

## Acceptance Criteria

- The UI explains how a NOT READY run becomes a READY rerun.
- Firewall blocking can be demonstrated from UI.
- Policy patch semantics are truthful and auditable.
- No UI action mutates Splunk.

## Verification

```bash
npx vitest run tests/gateway/firewall.test.ts tests/policy/patch.test.ts tests/cli/flow.test.ts tests/workbench tests/ui/app.test.ts
npm run build
npm run check
git diff --check
```

## Stop Conditions

- Stop before creating a fake before/after policy diff.
- Stop before adding waiver flows.
- Stop before applying policy patches to Splunk.
