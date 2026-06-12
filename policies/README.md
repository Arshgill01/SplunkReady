# Bundled SplunkReady Policies

This directory contains the named, versioned policy bundles that the
`splunkready/policy` current-source SDK exposes and that the `policy-publish` /
`evaluate --policy` CLI flow consumes.

## Files

| File | `id` | Version | Compliance framing |
| --- | --- | --- | --- |
| `default.policy.json` | `default-readiness` | `2026.06.07` | Baseline Splunk agent certification. |
| `soc2-readiness.policy.json` | `soc2-readiness` | `2026.06.07` | SOC2-oriented evidence and audit language. |
| `pci-dss-readiness.policy.json` | `pci-dss-readiness` | `2026.06.07` | PCI DSS-oriented sensitive-data framing. |

All three share the same 18-rule deterministic core and the same 11
required rule IDs; only `objective` and `splunkRefs` differ. The
deterministic rule engine stays authoritative.

## Schema

```json
{
  "schemaVersion": "splunkready.policy/v1",
  "id": "default-readiness",
  "name": "Default SplunkReady Readiness",
  "version": "2026.06.07",
  "description": "...",
  "requiredRuleIds": ["SPL-001", "SPL-003", "..."],
  "rules": [
    {
      "id": "SPL-001",
      "title": "No broad index search",
      "objective": "Reject unbounded or wildcard index searches.",
      "severity": "Critical",
      "splunkRefs": ["indexes"]
    }
  ],
  "tags": ["default", "splunk", "readiness"]
}
```

Severities must match the canonical deterministic-rule catalog; the SDK
rejects any bundle whose severity drifts.

## SDK

See `../src/policy-sdk/README.md` for the typed authoring surface. The
`splunkready/policy` subpath is present in current source and requires the next
npm release before it is available from the public registry.
