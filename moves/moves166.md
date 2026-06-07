# Move 166 - Operator Receipt KV Ingestion Proof

## Intent

Make the Splunk app's `splunkready_receipts` collection useful rather than just
declared. An operator should be able to push signed Readiness Receipts into the
installed Splunk app's KV Store, then verify that Splunk can query them through
`splunkready_receipts_lookup`.

## Scope

- Add an explicit operator command or workflow that imports a bounded set of
  signed receipt summaries from `submission-evidence/suite-proof/`.
- Require a confirm flag before writing to Splunk KV Store.
- Store only public-safe receipt fields:
  `receipt_id`, `receipt_hash`, `previous_receipt_hash`, `verdict`, `score`,
  `mutation`, `policy_id`, `policy_version`, `source`, and `updated_at`.
- Verify writes by reading the KV Store rows back through the lookup surface.
- Produce a redacted proof artifact under
  `submission-evidence/splunk-receipt-store/` with row counts, receipt hashes,
  lookup status, and `mutation` semantics explicitly labeled as
  operator-approved receipt storage, not automatic Splunk mutation.
- Add a dashboard-oriented sample so `splunkready_overview.xml` has meaningful
  operator-populated data after Move 165 installs the app.

## Non-Goals

- Do not upload raw traces, raw Splunk events, secrets, usernames, endpoint
  URLs, or deployment inventory.
- Do not make KV ingestion part of `judge-proof`, `mcp-proof`, `npm run check`,
  or default package install.
- Do not change receipt verdicts or make Splunk the grading authority.

## Verification

- No-env/no-confirm test proves the command returns `SKIP`.
- Local operator run writes a bounded receipt set and reads it back through
  `splunkready_receipts_lookup`.
- Receipt hashes match the source receipt-chain evidence.
- `npm run check`

