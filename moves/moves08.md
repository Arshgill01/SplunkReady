# Move 08 - Make Live Security Proof Reproducible Without Mutation

## Goal

Make the flagship live security story understandable and repeatable by an
operator while preserving SplunkReady's read-only contract.

## Source Truth

The existing `live-security-kit` command already generates an operator-owned
setup bundle and manual instructions. The app must not create indexes, install
or overwrite apps, create saved searches, ingest events, or restart Splunk.
Automating those writes would violate D006 and repository stop conditions.

## Scope

Expected files:

- existing live security kit generation and tests, only for validation or
  clearer output
- `docs/live-demo-data-plan.md`
- `docs/live-setup-checklist.md`
- `docs/live-proof-gap.md`
- judge-facing evidence produced through Move 06
- current wave and logs

No mutating setup script.

## Plan

1. Review the generated kit against a disposable Splunk Enterprise trial and a
   deployment that already has Enterprise Security.
2. Improve operator instructions for:
   - disposable-trial setup;
   - manual inspection before copying app content;
   - avoiding overwrite of a real `SplunkEnterpriseSecuritySuite`;
   - event import timing and cleanup;
   - readiness checks before running the strict proof.
3. Add non-mutating kit validation:
   - expected files and stanzas exist;
   - saved-search and index names match the live mission;
   - sample timestamps are generated appropriately;
   - generated README clearly labels every mutating command as operator-owned.
4. Run the existing sequence on the available live environment:
   `live-security-kit` -> operator setup -> `live-security-readiness` ->
   `live-security-proof` -> `proof-audit` -> `verify-manifest`.
5. Record elapsed setup time only if measured. Do not promise a five-minute
   setup without evidence.
6. Update docs so the fixture demo is the universal judge path and live proof is
   the demonstrated deployment-specific evidence.

## Acceptance Criteria

- SplunkReady itself performs no Splunk write operation.
- The generated kit is validated and safe to inspect.
- Docs warn against overwriting an existing ES app.
- The exact operator/proof sequence is reproducible and truthfully bounded.
- Live proof claims link to sanitized public evidence.

## Verification

```bash
npx vitest run tests/cli/flow.test.ts tests/adapters/live.test.ts tests/adapters/live.integration.test.ts
npm run splunkready -- live-security-kit --out <fresh-kit-dir>
npm run check
git diff --check
```

Live readiness/proof commands are conditional on the operator-owned environment.

## Stop Conditions

- Stop before adding executable Splunk mutation.
- Stop before overwriting or impersonating a real Enterprise Security app.
- Stop if the documentation makes fixture and live proof appear equivalent.
