# Move 207 - Strong Zed MCP External Client Session

## Status

Implemented on 2026-06-08. Branch-tip CI passed on commit
`2fdd96e611ffdaaa70c32a0aa292d94f88cb5867`.

## Objective

Upgrade the MCP category's real third-party-client evidence from compact Zed
proof to strong Zed proof. A passing result must show Zed Agent initiating a
multi-step MCP session through the SplunkReady recorder gateway, with at least
12 tracked frames, both `splunk` and `splunkready` server IDs, Splunk
investigation tools, visible `splunkready_recorder_flush`, a deterministic
`READY` receipt, redaction `PASS`, and no Splunk mutation.

## Expected touched files

- `moves/moves207.md`
- `docs/execplans/mcp-zed-strong-session.md`
- `docs/mcp-topology.md`
- `submission-evidence/mcp-proof/zed-client-session/*`
- `submission-evidence/mcp-proof/mcp-category-scorecard.json`
- `submission-evidence/mcp-proof/mcp-category-scorecard.md`
- `submission-evidence/screenshots/zed-mcp-strong-session.png`
- `submission-evidence/screenshots/zed-mcp-strong-receipt.png`
- `submission-evidence/README.md`
- `submission-evidence/claim-ledger.md`
- `submission-evidence/evidence-pack-sha256.txt`
- `scripts/audit-submission-copy.mjs`
- `tests/scripts/submission-copy-audit.test.ts`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- Zed settings backup and redacted context-server shape inspection.
- Zed Agent driven through Computer Use in an empty workspace.
- Redacted JSONL inspection confirming `>=12` frames and visible
  `splunkready_recorder_flush`.
- `node scripts/audit-mcp-category-evidence.mjs --out submission-evidence/mcp-proof --require-strong`
- focused tests for the MCP category evidence audit and submission-copy guards.
- screenshot capture and visual inspection.
- evidence-pack SHA-256 regeneration and verification.
- `npm run check`
- branch-tip CI.

## Boundaries

- Do not use live Splunk credentials for this move; configure the Zed context
  server against the credential-free mock Splunk MCP path.
- Do not destructively edit the user's Zed settings. Back up the file first and
  add a reversible context server.
- Do not claim a strong external-client session unless Zed itself initiates the
  MCP tool calls.
- Do not commit raw endpoints, tokens, env files, local secret paths, or
  unredacted Zed logs.
- Do not make LLM output authoritative for the Readiness Receipt.

## Result

- Backed up the user's Zed settings and added a reversible credential-free
  `splunkready-recorder` context server.
- Drove Zed Agent with GPT-5.5 Low through Computer Use in a disposable
  workspace.
- First attempted a deeper session that included `splunk_get_info`; the
  deterministic receipt correctly failed because `splunk_get_info` is not
  allowed by the selected security mission. That failed run was discarded and
  not promoted.
- Re-ran the session with only mission-allowed Splunk tools:
  `splunk_get_knowledge_objects`, `splunk_run_query`, and
  `splunk_run_saved_search`, followed by
  `splunkready_describe_certification` and `splunkready_recorder_flush`.
- Promoted sanitized evidence into
  `submission-evidence/mcp-proof/zed-client-session/`.
- Captured `submission-evidence/screenshots/zed-mcp-strong-session.png` and
  `submission-evidence/screenshots/zed-mcp-strong-receipt.png`.
- Updated the MCP category audit to require the new strong screenshot and to
  stop labeling strong Zed evidence as compact.
- Regenerated the MCP category scorecard with `status: "PASS"`, score `100`,
  `zedFrames: 15`, `zedEvidenceTier: "VERIFIED_STRONG"`, no warnings,
  deterministic authority, and `mutation: false`.

## Verification Result

- PASS: redaction scan over tracked Zed evidence and screenshots found no
  endpoint, token, env-secret, or local-path material.
- PASS: `node scripts/audit-mcp-category-evidence.mjs --out
  submission-evidence/mcp-proof --require-strong`.
- PASS: `npx vitest run tests/scripts/mcp-category-evidence.test.ts
  tests/scripts/submission-copy-audit.test.ts`.
- PASS: evidence-pack SHA-256 regeneration and verification.
- PASS: `git diff --check && npm run check` with 77 Vitest files and 448
  tests.
