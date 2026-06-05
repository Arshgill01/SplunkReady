# Move 99 - Public Judge Proof LLM Evidence Surface

## Goal

Make the hosted public demo expose the one-command `judge-proof` bundle and its
LLM evidence boundary without requiring credentials, reading secret env files, or
making LLM output authoritative.

## Scope

- Generate a credential-free `artifacts/judge-proof` bundle during public demo
  export.
- Include the judge proof bundle in `public-demo-manifest.json`.
- Validate the exported judge proof keeps `mutation=false` and
  `llmEvidence.passFailAuthority=deterministic-rule-engine`.
- Render judge proof and LLM evidence status in the existing proof-browser UI.
- Keep the main public demo route on the MCP proof view to avoid overloading the
  first screen.

## Verification

- `npx vitest run tests/scripts/public-demo-export.test.ts`
- `npx vitest run tests/ui/app.test.ts --testNamePattern "judge proof|artifact manifests|default artifact"`
- `npm run public-demo:build && npm run audit:public-demo-export`
- Playwright static-host check for
  `?artifacts=artifacts%2Fjudge-proof#proof-browser`
- `npm run check`
- `npm run verify:scaffold`
- `git diff --check`

## Boundaries

- Do not read, source, print, or commit `.splunkready*` or `.env*` files.
- Do not call Gemini in the public demo export.
- Do not make LLM evidence decide pass/fail.
- Do not introduce Splunk mutation or browser-side secret submission.
