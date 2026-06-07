# Move 138 - Hosted Demo Currentness Audit

## Intent

Make the public GitHub Pages demo source-traceable and machine-checkable so a
stale hosted demo cannot silently cap judge confidence.

## Scope

- Add `sourceCommit` and `sourceCommitShort` to
  `public-demo-manifest.json`.
- Add a separate `audit:hosted-demo-currentness` command that compares the
  hosted manifest commit and asset names against the current public-demo input
  commit.
- Keep the canonical `npm run check` offline; hosted currentness remains an
  explicit network audit.
- Do not copy, print, or depend on live Splunk secrets.

## Verification

- `npx vitest run tests/scripts/hosted-demo-currentness.test.ts tests/scripts/public-demo-export.test.ts`
- `npm run build && npm run ui:build && npm run audit:public-demo-export`
- `npm run audit:hosted-demo-currentness -- --out /tmp/splunkready-hosted-demo-currentness-before.json`

## Result

The local export now records the source commit. Focused tests and the public
demo export audit pass. The current hosted GitHub Pages demo reports `STALE`
because the deployed manifest predates this move and does not yet record
`sourceCommit`; assets still match local `dist-ui`.
