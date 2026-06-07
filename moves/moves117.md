# Move 117 - Live SAIA Not-Found Diagnostic

## Goal

Use the newly available operator-owned hosted-model setup to run the real live
SAIA diagnostic path, then improve the product based on the observed result
without making false hosted-model PASS claims.

## Scope

- Locate the ignored operator env file by filename only.
- Run `hosted-model-diagnostic --mode live --env-file ./.splunkready-live.env`
  without reading or printing the env file contents.
- Capture raw command stdout/stderr outside the repo and print only sanitized
  status fields.
- Preserve the advisory-only hosted-model boundary: SAIA output is evidence, not
  pass/fail authority.
- Improve blocked-result classification when the live contract advertises
  `saia_explain_spl` / `saia_optimize_spl`, but invocation returns not found.
- Add a regression test for that advertised-but-not-found failure mode.
- Update the live setup checklist with the new remediation path.

## Live Result

- The env file was found as `./.splunkready-live.env`; contents were not read or
  printed.
- A first live run without TLS override failed before artifacts with
  `fetch failed` while calling `splunk_get_info`.
- A second run with `NODE_TLS_REJECT_UNAUTHORIZED=0` compiled the live contract
  and wrote local ignored artifacts under
  `artifacts/live-hosted-model-diagnostic`.
- The diagnostic status was `BLOCKED`, not `PASS`.
- `mutation` was `false`.
- Required live variables were all reported as `set`.
- Required hosted-model tools were listed as available:
  `saia_explain_spl`, `saia_optimize_spl`.
- Hosted-model assistance was not present because invoking `saia_explain_spl`
  returned a not-found error.
- The improved diagnostic now reports that the endpoint advertises hosted-model
  tools but returns not found at invocation time, and recommends checking the
  MCP endpoint/tool route or app version.

## Verification

- `npm run build`
- `node dist/src/cli.js hosted-model-diagnostic --mode live --env-file ./.splunkready-live.env --out artifacts/live-hosted-model-diagnostic --require-pass true --json`
- `NODE_TLS_REJECT_UNAUTHORIZED=0 node dist/src/cli.js hosted-model-diagnostic --mode live --env-file ./.splunkready-live.env --out artifacts/live-hosted-model-diagnostic --require-pass true --json`
- `npx tsc --noEmit`
- `npx vitest run tests/cli/flow.test.ts --testNamePattern "hosted-model"`
- `npx vitest run tests/workflows/hosted-model-actions.test.ts`

## Boundaries

- Do not read, source, print, or commit real `.splunkready*` or `.env*`
  secret values.
- Do not commit `artifacts/live-hosted-model-diagnostic/*`; those are ignored
  operator-owned live artifacts and include deployment-specific details.
- Do not claim live SAIA PASS until `hosted-model-diagnostic.json` reports
  `status: "PASS"` and `permission.status: "OK"`.
- Do not make SAIA or any LLM output authoritative for pass/fail readiness.
- Do not mutate Splunk.
- Do not use subagents.
