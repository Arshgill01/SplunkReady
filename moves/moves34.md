# Move 34 - SplunkReady Secret Env Ignore

## Goal

Prevent accidental commits of local `.splunkready*` secret-bearing environment
files.

## Scope

Expected files:

- `.gitignore`
- `moves/README.md`
- logs

## Plan

1. Verify the current ignore behavior without reading secret file contents.
2. Replace the one-off `.splunkready-live.env` ignore with a `.splunkready*`
   pattern.
3. Keep a narrow exception for a future checked-in `.splunkready.example` file.
4. Verify representative `.splunkready*` names are ignored.

## Acceptance Criteria

- `.splunkready`, `.splunkready.local`, `.splunkready.env`, and
  `.splunkready-live.env` are ignored.
- `.env` and `.env.*` ignore behavior remains unchanged.
- No secret env file is read, sourced, printed, or committed.

## Verification

```bash
git check-ignore -v .splunkready .splunkready.local .splunkready.env .splunkready-live.env .env .env.local
npm run verify:scaffold
git diff --check
```

## Stop Conditions

- Stop before reading `.splunkready*`, `.env`, or other secret-bearing files.
- Stop before changing runtime environment loading behavior.
