# Move 176 - LLM Deliberation Workbench View

## Intent

Make the Move 175 LLM deliberation artifacts visible in the Vite workbench so
judges can inspect the advisory AI layer instead of finding it only in JSON.

## Scope

- Load `llm-deliberation-before.json` and `llm-deliberation-after.json` through
  the normal schema-backed UI artifact loader.
- Add a dedicated `LLM` workbench view that renders the advisory boundary,
  before/after quality scores, structured plan fields, observations, answer
  provenance, uncertainty, safety notes, next actions, dimension scores, and
  output-quality findings.
- Track a Playwright screenshot from the real Splunk LLM stress evidence bundle.
- Keep deterministic Readiness Receipt verdict authority explicit in the UI.

## Non-Goals

- Do not make LLM output a readiness verdict.
- Do not add a chatbot surface.
- Do not require live Splunk credentials for the default workbench.
- Do not redesign unrelated workbench views.

## Verification

- `npx vitest run tests/ui/app.test.ts`
- `npm run ui:build`
- Playwright open/snapshot/screenshot of
  `http://127.0.0.1:5191/#llm-deliberation` with
  `SPLUNKREADY_UI_ARTIFACT_DIR=submission-evidence/real-splunk-stress-llm-layer`.
