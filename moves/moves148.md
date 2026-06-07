# Move 148 - Hash-Chain Receipt Signing And Replay Lineage

## Intent

Turn Readiness Receipts into verifiable, replayable audit artifacts with stable
hashes, chain pointers, and receipt-chain verification.

## Scope

- Add receipt hash and previous receipt hash support.
- Add key initialization and public-key evidence.
- Add receipt-chain verification CLI.
- Add deterministic receipt replay workflow.

## Verification

- `npx splunkready verify-receipt-chain --dir submission-evidence/suite-proof --public-key submission-evidence/receipt-public-key.pem --json`
- Focused receipt-chain tests.
- `npm run check`.

## Result

Not started.
