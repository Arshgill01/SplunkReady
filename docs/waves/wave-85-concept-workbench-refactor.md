# Wave 85 - Concept Workbench Refactor

## Goal

Port the strongest ideas from `/Users/arshdeepsingh/Developer/SplunkReady-concepts-3` into the main Vite workbench without regressing proof inspection, deterministic receipt evidence, or fixture/live honesty.

The wave treats Gemini's concept worktree as design input, not source of truth. The implementation must refactor the main UI into a more legible certification dossier while preserving existing data contracts and tests.

## Scope

- Compare the concept worktree against the main UI one-to-one.
- Adopt the useful product-design direction: clearer verdict hierarchy, stronger receipt-first layout, lighter dense surfaces, better sidebar state, and fewer prose-heavy blocks.
- Replace concept inline styles with maintainable CSS classes and existing render helpers.
- Keep all existing proof bundle, readiness profile, hosted-model status, and artifact inspection behavior intact.
- Verify with targeted UI tests, build checks, and browser inspection.

## Non-Goals

- Do not rebuild the workbench as a new app.
- Do not make SplunkReady a chatbot, SOC copilot, telemetry dashboard, or marketing page.
- Do not change receipt schemas, pass/fail grading, live Splunk behavior, or Splunk mutation policy.
- Do not copy concept code that weakens accessibility, maintainability, or provenance clarity.
- Do not introduce new production dependencies for visual polish.

## Files Owned

- `PRODUCT.md`
- `docs/waves/wave-85-concept-workbench-refactor.md`
- `ui/src/render.ts`
- `ui/src/styles.css`
- focused UI/workbench tests when assertions require updates
- `logs/execution-log.md`
- `logs/verification-log.md`

## Verification

- `npm test -- tests/ui/shell.test.ts`
- `npm test -- tests/workbench/workbench.test.ts`
- `npm run ui:build`
- Browser or Playwright inspection of the Vite workbench at desktop and narrow viewport
- `npm run check`
- `git diff --check`

## Reviewer Checklist

- Does the UI remain receipt/proof-led instead of dashboard-led?
- Are long explanations replaced with scannable structure without hiding evidence?
- Does the implementation avoid inline style sprawl from the concept branch?
- Are readiness states represented with text and structure, not color alone?
- Does running/queued state avoid stale score or verdict claims?
- Does the workbench still expose architecture, proof bundles, hosted-model status, and readiness profile evidence accurately?

## Acceptance Criteria

- The main workbench has a visibly cleaner certification-dossier hierarchy inspired by the concept branch.
- The sidebar and receipt view show current verdict state without stale active-run scores.
- The design system is documented enough for `/impeccable` to operate through `PRODUCT.md`.
- Targeted UI/workbench tests pass.
- A local browser inspection confirms no obvious overflow, blank screen, or broken primary layout.

## Stop Conditions

- UI copy implies live Splunk or SAIA proof without real evidence.
- Any pass/fail decision becomes LLM-authored.
- The refactor removes receipt provenance, readiness profile evidence, or trace inspection.
- The workbench becomes harder to verify from tests or generated proof artifacts.
