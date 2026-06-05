# Move 35 - Secret Env Ignore Gate

## Goal

Make the local secret environment-file ignore boundary part of the canonical
verification gate.

## Scope

Expected files:

- `package.json`
- `scripts/audit-secret-env-ignore.sh`
- `moves/README.md`
- logs

## Plan

1. Add a small project-native audit script that checks representative
   `.splunkready*` and `.env*` paths with `git check-ignore`.
2. Keep example-file exceptions available for future checked-in examples.
3. Wire the audit into `npm run check`.

## Acceptance Criteria

- `.splunkready`, `.splunkready.local`, `.splunkready.env`, and
  `.splunkready-live.env` must remain ignored.
- `.splunkready.example` must remain available for a future checked-in example.
- `.env` and `.env.local` must remain ignored, while `.env.example` remains
  available.
- The canonical `npm run check` fails if this boundary regresses.
- No secret env file is read, sourced, printed, or committed.

## Verification

```bash
npm run audit:secret-env-ignore
npm run check
git diff --check
```

## Stop Conditions

- Stop before reading `.splunkready*`, `.env`, or other secret-bearing files.
- Stop before changing runtime environment loading behavior.
