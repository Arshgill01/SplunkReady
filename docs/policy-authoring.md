# SplunkReady Policy Authoring

SplunkReady policies are named, versioned bundles that select existing
deterministic grader rules. They are not executable code and they do not make
LLM or SAIA output authoritative.

## Format

Policy files live under `policies/` and use the suffix `.policy.json`.

Required fields:

- `schemaVersion`: currently `splunkready.policy/v1`
- `id`: stable policy identifier
- `name`: human-readable policy name
- `version`: policy version shown in receipts
- `description`: short policy purpose
- `requiredRuleIds`: deterministic rules that must be active for a mission
- `rules`: allowed deterministic rule catalog entries

Each rule entry names an existing SplunkReady grader rule and may include
display text plus Splunk contract references:

```json
{
  "id": "SAF-003",
  "title": "Read-only Splunk tools",
  "objective": "Permit only read-only Splunk operations and never claim mutation.",
  "severity": "Critical",
  "splunkRefs": ["mcpTools"]
}
```

The severity must match SplunkReady's canonical deterministic rule severity.
This prevents a policy from downgrading a critical rule by changing JSON.

## Authoring Workflow

1. Copy `policies/default.policy.json`.
2. Change `id`, `name`, `version`, `description`, and `tags`.
3. Keep `rules` tied to existing grader rule IDs.
4. Set `requiredRuleIds` to the rules that must be active for the target mission.
5. Run:

```bash
npx splunkready policy-publish --policy policies/soc2-readiness.policy.json --json
```

For a fixture evaluation that records policy identity in the Readiness Receipt:

```bash
npx splunkready compile --out ./policy-eval --json
npx splunkready evaluate --out ./policy-eval --policy pci-dss-readiness --json
npx splunkready receipt --out ./policy-eval --json
```

The resulting receipt includes:

```json
{
  "policy": {
    "id": "pci-dss-readiness",
    "name": "PCI DSS Splunk Agent Readiness",
    "version": "2026.06.07",
    "hash": "..."
  }
}
```

## Signing

`policy-publish` writes a `*.policy-manifest.json` with:

- canonical policy hash
- Ed25519 signature
- public key
- `deterministicAuthority: true`
- `mutation: false`

If no key is supplied, SplunkReady generates an ephemeral Ed25519 key for that
manifest. To use an explicit key pair:

```bash
npx splunkready keys init --out ./keys --json
npx splunkready policy-publish \
  --policy policies/soc2-readiness.policy.json \
  --private-key ./keys/receipt-private-key.local.pem \
  --public-key ./keys/receipt-public-key.pem \
  --json
```

Never commit private keys. The local private key file name ends with
`.local.pem` for that reason.

## Failure Boundaries

Policy evaluation fails closed when:

- the policy references an unknown rule ID;
- a rule severity does not match the canonical deterministic severity;
- `requiredRuleIds` names a rule missing from `rules`;
- the active mission uses a check not allowed by the policy;
- the policy requires a rule the active mission does not activate.

Policies make the rule set shareable and auditable. The deterministic TypeScript
rule modules still decide pass/fail.
