# Move 80: MCP Proof Evidence Screenshot

## Goal

Make the Move 79 MCP workbench proof visible in the tracked judge-facing
evidence pack.

## Scope

- Track a Playwright screenshot of the `MCP` workbench view.
- Update `submission-evidence/README.md` and `claim-ledger.md` so judges can
  find the screenshot and map it to the MCP proof claims.
- Regenerate `submission-evidence/evidence-pack-sha256.txt`.
- Verify the evidence pack hashes and submission-copy audit.

## Non-goals

- Do not regenerate proof JSON.
- Do not change product code.
- Do not read, source, print, or commit `.splunkready*` or `.env*` files.

## Expected verification

- `shasum -a 256 -c submission-evidence/evidence-pack-sha256.txt`
- `npm run audit:submission-copy`
- `git diff --check`
