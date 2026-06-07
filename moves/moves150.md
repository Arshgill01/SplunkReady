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

Not started.
