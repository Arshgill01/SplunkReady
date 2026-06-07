# Move 149 - Interactive Public Certification Demo

## Intent

Let judges run a real certification action from the hosted demo by uploading or
pasting trace JSON and receiving a real Readiness Receipt.

## Scope

- Bundle a certifier endpoint for hosted execution.
- Add hosted UI route `?demo=interactive`.
- Accept trace JSON and render receipt, violations, evidence refs, and policy
  patch summary.
- Add browser verification and screenshot evidence.

## Verification

- Deployed endpoint smoke.
- Playwright upload/paste certification flow.
- Public demo export and hosted currentness audits.

## Result

Implemented in Move 149.

- Added `?demo=interactive` routing to load a dedicated public
  `artifacts/interactive-demo` bundle.
- Added browser-hosted deterministic trace certification in
  `ui/src/interactiveCertifier.ts`.
- Added the `#interactive-certification` workbench view with trace paste/upload,
  receipt, violations, evidence refs, receipt hash, and policy patch summary.
- Updated the public demo export to generate
  `artifacts/public-demo/artifacts/interactive-demo/` with its own artifact
  manifest.
- Captured Playwright evidence at
  `submission-evidence/screenshots/interactive-demo.png`.

Verification:

- `npm run build && npm run ui:build && npm run audit:public-demo-export && npx vitest run tests/ui/app.test.ts tests/scripts/public-demo-export.test.ts --testNamePattern "interactive certification|browser without workbench|external import|public demo export|normalizes artifact"` passed.
- Playwright opened `http://127.0.0.1:4179/?demo=interactive`, clicked
  `Certify trace`, and verified `PASS`, `READY`, score `100`,
  `receipt-interactive-001`, receipt hash, evidence refs, and `mutation=false`.
