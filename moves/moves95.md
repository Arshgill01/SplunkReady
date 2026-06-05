# Move 95: GitHub Pages Public Demo Workflow

## Goal

Reduce the hosted-demo probability cap by adding a reviewable GitHub Pages
deployment path for the verified credential-free public demo export.

## Scope

- Add a manual `workflow_dispatch` GitHub Pages workflow.
- Build `artifacts/public-demo` from the Vite workbench and tracked submission
  evidence.
- Run `audit:public-demo-export` before uploading the Pages artifact.
- Keep the workflow free of live Splunk, Gemini, npm, or deployment secrets.
- Add repository workflow coverage so future edits preserve the deployment
  boundary.
- Document how to run the workflow without claiming an unverified public URL.

## Non-goals

- Do not claim a hosted demo URL until the workflow has run and the Pages URL
  has been opened successfully.
- Do not use Netlify in this move.
- Do not add secrets or read `.splunkready*` / `.env*` files.
- Do not auto-run deployment on every push.
- Do not change UI source or behavior.
- Do not change deterministic grading, LLM/SAIA authority, MCP behavior, or
  Splunk mutation boundaries.

## Expected verification

- `npx vitest run tests/examples/repository-ci-workflow.test.ts`
- `npm run public-demo:build && npm run audit:public-demo-export`
- `npm run check`
- `git diff --check`
