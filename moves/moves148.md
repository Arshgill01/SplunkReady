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

First slice implemented. Added `verify-receipt-chain --dir <dir> [--public-key
<path>]`, backed by `src/workflows/receipt-chain.ts`. The workflow discovers
schema-valid `receipt-*.json` files under a proof bundle, computes stable
SHA-256 hashes over canonical JSON, links each receipt to the previous receipt
hash, and writes `receipt-chain.json` with `mutation: false` and
`deterministicAuthority: true`. The tracked
`submission-evidence/suite-proof/receipt-chain.json` chains six suite receipts
and reports `PASS`. The verifier excludes its own `receipt-chain.json` output,
so rerunning the command on the same directory is idempotent.

Deferred: embedded `receiptHash` / `previousReceiptHash` fields on generated
receipts, key initialization, receipt signatures, and deterministic replay
re-derivation. This slice establishes the chain verifier and tracked evidence
without changing the existing receipt schema or pass/fail authority.

Second slice implemented. Added `keys init`, `sign-receipt`, Ed25519
chain-signature verification, and tracked public-key evidence at
`submission-evidence/receipt-public-key.pem`. The tracked suite proof
`receipt-chain.json` now reports `signature.status: "VERIFIED"` and
`signature.algorithm: "ed25519"` when checked with
`verify-receipt-chain --public-key submission-evidence/receipt-public-key.pem`.
The private signing key was generated under `/tmp`, used to sign the tracked
chain, then removed; no private key is tracked.

Deferred: embedded receipt hash fields and deterministic replay re-derivation.
