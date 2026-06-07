# Move 110 - SAIA live proof readiness

## Goal

Make the hosted-model/SAIA track ready for the operator-owned live token run
without leaking secrets or turning SAIA into the readiness judge.

## Scope

- Produce reviewable `hosted-model-proof.json` and
  `hosted-model-diagnostic.json` artifacts even when live SAIA configuration is
  missing from the current shell.
- Record only live setup presence (`set` / `missing` / `invalid`) for required
  environment variables; never write token values.
- Surface the setup status in the existing hosted-model workbench panels.
- Prove public proof export redacts hosted-model proof and diagnostic content.
- Document the blocked-artifact behavior in the live setup docs.

## Verification

- `npx tsc --noEmit`
- `npx vitest run tests/workflows/hosted-model-actions.test.ts tests/cli/flow.test.ts --testNamePattern "hosted-model"`
- `npx vitest run tests/workflows/public-proof-export.test.ts`
- `npx vitest run tests/ui/app.test.ts`
- `npm run build`
- `node dist/src/cli.js hosted-model-diagnostic --mode live --out artifacts/hosted-model-diagnostic --json`
- Playwright open/snapshot/screenshot for the hosted-model diagnostic route.
- `git diff --check`
- `npm run check`

## Boundaries

- Do not read, source, print, or commit `.splunkready*` or `.env*` files.
- Do not claim live SAIA PASS unless the token-bearing run actually passes.
- Do not make SAIA or any LLM output authoritative for pass/fail readiness.
- Do not execute the unsafe SPL query.
- Do not add Splunk write operations.
- Do not run `npm publish`.
- Do not use subagents.
