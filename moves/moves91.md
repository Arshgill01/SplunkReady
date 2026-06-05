# Move 91: Public Demo Export Gate

## Goal

Reduce the hosted-demo probability cap by making the credential-free public demo
export a canonical verified artifact.

## Scope

- Add a public demo export audit script.
- Regenerate `artifacts/public-demo` from the built Vite workbench and tracked
  submission evidence during the canonical check.
- Verify the public demo manifest, default MCP proof route, required proof
  bundles, screenshots, no symlinks, no secret-named files, and `mutation=false`.
- Add the audit to `npm run check`.
- Clean ignored `.playwright-cli/` scratch output from the local worktree.

## Non-goals

- Do not perform an external Netlify deploy when Netlify auth/link status cannot
  be confirmed non-interactively.
- Do not change UI source or behavior.
- Do not include ignored live proof artifacts or deployment inventory in the
  tracked pack.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.
- Do not change deterministic grading, LLM/SAIA authority, MCP behavior, or
  Splunk mutation boundaries.

## Expected verification

- `npm run ui:build && npm run audit:public-demo-export`
- `npm run check`
- `git diff --check`
