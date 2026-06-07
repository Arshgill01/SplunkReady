# Move 150 - Signed Multi-Tenant Policy Registry

## Intent

Make policies named, versioned, signed, and shareable so teams can certify
agents against their own Splunk readiness standards.

## Scope

- Add JSON policy file format.
- Add policy validation/signing command.
- Add policy install/evaluate support.
- Ship default, SOC2, and PCI-DSS example policies.

## Verification

- `npx splunkready policy-publish --policy policies/soc2-readiness.policy.json --json`
- `npx splunkready evaluate --policy pci-dss-readiness ...`
- Policy schema tests and `npm run check`.

## Result

Implemented on 2026-06-07.

Delivered:

- Added typed `splunkready.policy/v1` JSON bundles for default, SOC2, and PCI
  DSS readiness under `policies/`.
- Added signed policy registry helpers in `src/policies/registry.ts`.
- Added `policy-publish` and `policy-install` CLI commands.
- Added `evaluate --policy <name|path>` support. Policy evaluation validates the
  policy against active mission checks, writes `policy-evaluation.json`, and
  causes generated Readiness Receipts to include policy id/name/version/hash.
- Added policy identity display in generated receipt Markdown, the static shell,
  and the Vite receipt route.
- Added `docs/policy-authoring.md`.
- Added tracked signed policy registry evidence under
  `submission-evidence/policy-registry/`.
- Updated submission-copy guardrails to require the policy-registry claim.
- Fixed and validated `Dockerfile.mock-splunk-mcp`; the mock image now builds and
  responds to stdio JSON-RPC from inside the container.

Verification:

- `npm run build`
- `node dist/src/cli.js policy-install --policy default-readiness --out submission-evidence --json`
- `node dist/src/cli.js policy-install --policy soc2-readiness --out submission-evidence --json`
- `node dist/src/cli.js policy-install --policy pci-dss-readiness --out submission-evidence --json`
- `npx vitest run tests/policies/registry.test.ts tests/cli/flow.test.ts tests/scripts/submission-copy-audit.test.ts --testNamePattern "policy|submission copy"`
- `npm run audit:submission-copy`
- `docker build -f Dockerfile.mock-splunk-mcp -t splunkready/mock-splunk-mcp:local .`
- Container stdio smoke for `initialize`, `tools/list`, and
  `splunk_run_saved_search`
- `docker compose -f docker-compose.mock.yml config`
- `docker compose -f docker-compose.mock.yml build mock-splunk-mcp`
- Playwright opened
  `http://127.0.0.1:4182/dist-ui/index.html?artifacts=..%2Fartifacts%2Fpolicy-eval#receipt`
  and verified the receipt route renders
  `Policy PCI DSS Splunk Agent Readiness 2026.06.07 / pci-dss-readiness`.
- `shasum -a 256 -c submission-evidence/evidence-pack-sha256.txt`
- `npm run check`

Open notes:

- The policy language intentionally selects existing deterministic rule IDs
  rather than defining executable rules. That keeps deterministic TypeScript
  rules authoritative.
- The Playwright policy-receipt smoke used a before-phase-only temp proof
  bundle, so optional missing-artifact fetches produced 404 console entries.
  The policy row itself rendered correctly.
