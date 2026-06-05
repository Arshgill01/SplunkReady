# Move 25 - Consolidate Workbench UI Surface

## Goal

Trim the final workbench experience so judges see the clearest proof path
without losing the instrumentation needed to verify and debug the submission.

## Scope

Expected files:

- UI navigation and proof-browser rendering
- README or demo-path docs if the launch flow changes
- Playwright screenshots
- logs

## Plan

1. Audit every workbench view against the judging story: run certification,
   inspect receipt, inspect trace, export public proof.
2. Keep testing/debug affordances that are still needed before final submission.
3. Collapse, relabel, or move secondary panels only when evidence shows they
   distract from the proof path.
4. Preserve deterministic evidence links, raw artifact access, and redaction
   labels.
5. Run Playwright across desktop and mobile widths after each UI reduction.
6. Record before/after screenshots and any deferred cleanup.

## Acceptance Criteria

- The first workbench screen remains a usable certification workflow.
- The judge path is shorter and easier to scan.
- Debug/test instrumentation remains available where needed.
- No proof claim, artifact link, or redaction boundary is hidden or weakened.
- Playwright screenshots show no overlapping or overloaded UI.

## Verification

```bash
npm run check
npm run ui:build
git diff --check
```

Use Playwright to run fixture certification, inspect Runs, inspect Trace, and
verify the public proof export panel at desktop and mobile widths.

## Stop Conditions

- Stop before removing evidence needed for final clean-room verification.
- Stop before hiding fixture/live parity or deterministic grading evidence.
- Stop before deleting debug UI that is still required by an unfinished move.
