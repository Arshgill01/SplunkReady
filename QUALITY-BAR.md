# Quality Bar

## Strict Confidence Benchmark

The build is not ready until confidence exceeds 85% on this benchmark.

Score each category from 0-10:

1. Product focus
2. Schema stability
3. Fixture/live parity
4. Deterministic grader coverage
5. Specimen agent honesty
6. Receipt provenance
7. Test coverage
8. UI clarity
9. Demo reproducibility
10. Submission readiness

Total confidence = average * 10.

## Minimum Required Scores

- Product focus: 9
- Deterministic grader coverage: 8
- Specimen agent honesty: 8
- Demo reproducibility: 9
- Submission readiness: 8

If any minimum fails, confidence cannot exceed 85%.

## Anti-Slop Tests

Ask these before every milestone:

- Are we building a certification harness, or did this become a chatbot?
- Does the grader inspect trace structure, or is an LLM judging vibes?
- Does the receipt cite real tool/evidence provenance?
- Can fixture and live mode use the same code path after the adapter?
- Does the demo agent fail naturally?
- Does a judge understand the product in one sentence?

## Verification Passes

Before declaring a phase complete:

1. Structural pass: files, links, commands, ownership.
2. Product pass: no generic-agent drift.
3. Evidence pass: every claim traces to source, schema, test, or receipt.

