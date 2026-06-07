# Move 162 - Typed Policy SDK

## Intent

Turn signed JSON policy bundles into a developer platform. Teams should be able
to author policies as typed TypeScript, test them locally, sign them, and compile
them into the existing deterministic policy registry format.

## Scope

- Add package subpath `splunkready/policy`.
- Expose `definePolicy`, `defineRule`, `compilePolicy`, `signPolicy`, and
  `verifyPolicy` helpers.
- Add `splunkready test-policy --policy <file.ts> --trace <trace.json>`.
- Port the default, SOC2, and PCI DSS examples to typed policy source while
  preserving the existing signed JSON outputs.
- Add clean consumer-project tests for the package subpath.

## Non-Goals

- Do not let custom policy code become an LLM verdict path.
- Do not execute untrusted policy files in the browser.
- Do not remove the existing JSON policy format.

## Verification

- Focused policy SDK tests.
- Clean temp consumer project import test.
- `npm run check`
