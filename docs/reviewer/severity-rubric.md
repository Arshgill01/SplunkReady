# Reviewer Severity Rubric

## Critical

Blocks next wave.

Examples:

- LLM used as primary pass/fail grader.
- Specimen agent scripted to fail/pass.
- Fixture and live adapters diverge.
- Receipt claim lacks trace/evidence provenance.
- Secret or credential committed.
- Product drifts into chatbot/copilot.

## High

Should block unless explicitly waived.

Examples:

- Missing negative tests for a grader rule.
- Schema field added without fixture update.
- Demo trap no longer deterministic.
- Live mode required for fixture test.

## Medium

Fix before phase end.

Examples:

- Confusing naming.
- Reviewer checklist gap.
- Missing docs for a new command.
- Weak error message.

## Low

Track but do not block.

Examples:

- Minor wording issue.
- Non-critical formatting inconsistency.
- Optional polish.

## Waiver Rule

Every waiver must include:

- finding id;
- reason for waiver;
- risk accepted;
- planned revisit wave, or "accepted permanently".

