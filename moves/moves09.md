# Move 09 - Harden External-Agent CLI Integration

## Goal

Present and verify the existing external-agent path as a credible CLI
integration and CI gate without overstating it as an SDK.

## Positioning

Use this accurate description:

> SplunkReady is an offline certification CLI for Splunk-connected agents. It
> accepts a canonical single-mission trace or a captured Splunk MCP transcript,
> grades it with mission-selected deterministic checks, and emits auditable
> receipts, proof manifests, and CI-ready exit codes.

The preferred path is `certify-mcp-transcript`. The advanced path is `compile`
followed by `grade-trace`.

## Scope

Expected files:

- `examples/README.md`
- existing external trace and MCP transcript examples
- the GitHub Actions workflow example
- README and Devpost claims updated by Move 10
- focused example/CLI tests only where documented flows reveal a defect
- current wave and logs

Do not add Python/TypeScript SDKs, package publishing, generated schema docs, or
a reusable GitHub Action in this move.

## Plan

1. Make `examples/README.md` the canonical integration guide.
2. Document two exact passing workflows:
   - known read-only Splunk MCP transcript plus the SplunkReady-specific
     appended `final_answer` record, certified with strict import and
     require-pass;
   - external `TraceEvent[]`, with `compile` before `grade-trace`, followed by
     proof audit and manifest verification.
3. State boundaries clearly:
   - clone/build prerequisite;
   - `--mission` is a mission file path;
   - single-mission grading per invocation;
   - strict transcript import checks structure, not readiness;
   - known read-only MCP tool restriction;
   - final answer and evidence references remain producer-supplied inputs;
   - canonical trace has 13 required and 4 optional fields;
   - implemented versus cataloged rule count until Move 02 completes.
4. Label the workflow example as a GitHub Actions workflow example, not a
   reusable action.
5. Run both documented paths from a clean checkout and copy the exact commands
   into judge-facing docs.
6. Remove or correct existing "SDK" language wherever it overstates the public
   interface.

## Acceptance Criteria

- A new developer can run both paths exactly as documented.
- No command omits the required compile step.
- No docs claim an npm package, public library API, SDK, or reusable action.
- The integration guide explains trust boundaries and limitations.
- Claims about rule count change only after Move 02 is complete.

## Verification

```bash
npm run build
npx vitest run tests/examples/external-trace.test.ts tests/cli/flow.test.ts
npm run check
git diff --check
```

Also execute the two documented clean-room workflows verbatim.

## Stop Conditions

- Stop before package publishing or adding a public API.
- Stop before inventing helper functions or CLI flags that do not exist.
- Stop before calling producer-supplied evidence independently verified.
