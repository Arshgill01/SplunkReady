# Move 100 - Published Package Judge Smoke

## Goal

Turn the completed npm publication into verified judge-facing evidence.

## Scope

- Smoke test `splunkready@0.1.0` from a clean temp folder through `npx`.
- Verify the generated judge proof returns `PASS`, keeps `mutation=false`, and
  records deterministic pass/fail authority.
- Update README and Devpost copy with the npm badge, clean-folder `npx`
  command, and install snippet.
- Update the submission claim ledger from publish-ready to published-package
  evidence.
- Push the branch after local verification passes.

## Verification

- `npx -y splunkready@0.1.0 judge-proof --out ./judge-proof --json`
- Parse `judge-proof/judge-proof-summary.json` for `status`, `mutation`,
  `llmEvidence.status`, and `llmEvidence.passFailAuthority`.
- `npm run check`
- `git diff --check`

## Boundaries

- Do not run `npm publish`; the user already completed publication.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.
- Do not claim live Splunk proof from the published package smoke.
