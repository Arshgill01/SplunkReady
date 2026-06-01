# Reviewer Loop

The reviewer is mostly read-only.

## Inputs

- Current wave file.
- Current code/docs diff.
- `logs/execution-log.md`.
- `logs/verification-log.md`.
- `logs/risk-register.md`.

## Reviewer Output

Write a new file under `logs/reviewer-inbox/`:

```text
logs/reviewer-inbox/wave-XX-YYYYMMDD-HHMM-review.md
logs/reviewer-inbox/wave-XX-YYYYMMDD-HHMM-rereview.md
```

Each file must include:

- wave id;
- timestamp;
- verdict: pass, pass with concerns, fail;
- findings ordered by severity;
- exact file references;
- suggested checks;
- whether main executor must block next wave.

## Review Priorities

1. Does implementation match the current wave?
2. Did the executor touch out-of-scope files?
3. Are schemas still coherent?
4. Is grader logic deterministic?
5. Did fixture/live parity regress?
6. Are tests meaningful?
7. Is demo honesty preserved?

## Reviewer Boundaries

Do not edit source by default.

Do not commit.

Do not invent new product direction.

Do not request cosmetic refactors unless they affect clarity, correctness, or demo risk.
