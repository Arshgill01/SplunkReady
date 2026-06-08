# Move 188 - MCP Category Evidence Boundaries

## Status

Implemented on 2026-06-08.

## Objective

Make the MCP category story auditable without overclaiming the current
third-party-client evidence. The existing MCP server surface is broad enough for
the category, but the Zed external-client session is intentionally small. This
move adds a scorecard and audit that separates:

- first-party SplunkReady MCP proof;
- credential-free mock Splunk MCP composition;
- AppInspect MCP composition;
- Zed-triggered external-client investigation frames;
- deterministic certification of the captured frames.

## Expected touched files

- `moves/moves188.md`
- `docs/execplans/mcp-category-evidence-boundaries.md`
- `docs/mcp-topology.md`
- `scripts/audit-mcp-category-evidence.mjs`
- `tests/scripts/mcp-category-evidence.test.ts`
- `submission-evidence/mcp-proof/mcp-category-scorecard.json`
- `submission-evidence/mcp-proof/mcp-category-scorecard.md`
- `submission-evidence/README.md`
- `submission-evidence/claim-ledger.md`
- `submission-evidence/evidence-pack-sha256.txt`
- `logs/execution-log.md`
- `logs/verification-log.md`
- `logs/risk-register.md`

## Verification

- `node scripts/audit-mcp-category-evidence.mjs --out submission-evidence/mcp-proof`
- `npx vitest run tests/scripts/mcp-category-evidence.test.ts`
- `npm run audit:submission-copy`
- evidence-pack SHA-256 regeneration and verification
- `git diff --check`

## Boundaries

- Do not edit package input files after the `0.1.5` publish.
- Do not claim the Zed JSONL contains a visible `splunkready_recorder_flush`
  tool frame unless the tracked JSONL actually contains it.
- Do not claim external-client evidence is stronger than the tracked frames.
- Do not mutate real Splunk.

## Result

- Added `docs/mcp-topology.md` with the MCP composition graph and claim
  boundary.
- Added `scripts/audit-mcp-category-evidence.mjs`.
- Added `tests/scripts/mcp-category-evidence.test.ts`.
- Generated `submission-evidence/mcp-proof/mcp-category-scorecard.json` and
  `.md`.
- Updated the claim ledger to mark the Zed evidence as supported with
  limitations instead of overclaiming a visible `splunkready_recorder_flush`
  frame in the tracked JSONL.

The scorecard reports `PASS_WITH_LIMITATIONS`, score `96`, deterministic
authority, `mutation: false`, 6 tools, 13 resources, 1 resource template, 6
prompts, and `zedEvidenceTier: "VERIFIED_COMPACT"`.
