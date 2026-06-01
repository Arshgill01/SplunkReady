# Wave 29 - Query Budget Checks

## Goal

Grade query and tool-call budgets.

## Scope

- Time range budget.
- Event/result cap.
- Tool-call count.
- Rate-limit policy context.

## Files Owned

- budget rule files.
- tests.

## Acceptance Criteria

- Over-budget trace fails.
- Narrowed or approval-seeking path passes.
- Budget violation cites policy id.

## Verification

- budget tests.

## Reviewer Checklist

- Are budgets compiled from policy?
- Is user approval modeled separately?

## Stop Conditions

- Budget checks are hardcoded only for demo prompt.

