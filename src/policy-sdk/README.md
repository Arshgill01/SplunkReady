# SplunkReady Policy SDK

`splunkready/policy` is the typed policy authoring surface for SplunkReady's
Agent Readiness Compiler. It loads the bundled default, SOC2, and PCI DSS
readiness bundles, validates user-authored bundles against the canonical
deterministic rule catalog, signs and verifies bundles with the same ed25519
manifest scheme used by the signed policy registry, and reports mission-binding
gaps before a trace is graded.

## Install

```bash
npm install splunkready
```

The SDK ships under the `splunkready/policy` subpath in current source. It is
not present in the already published `splunkready@0.1.9` package; publish and
verify the next package release before treating this as a public npm surface.
No runtime dependencies are added beyond `zod`, which the package already
declares.

## Quick Start

```ts
import { policy, loadPolicy, listBuiltinPolicies, checkPolicyCompatibility } from "splunkready/policy";

const builtins = await listBuiltinPolicies();
// [
//   { id: "default-readiness", name: "...", version: "2026.06.07", hash: "..." },
//   { id: "pci-dss-readiness",  name: "...", version: "2026.06.07", hash: "..." },
//   { id: "soc2-readiness",      name: "...", version: "2026.06.07", hash: "..." },
// ]

const bundle = await loadPolicy("pci-dss-readiness");
const binding = policy.bindToMission(bundle, mission);
if (!binding.compatible) {
  throw new Error(`policy gaps: ${binding.missionRulesNotInPolicy.join(", ")}`);
}
```

The same surface is also exposed under a single `policy` namespace:

```ts
import { policy } from "splunkready/policy";

const builtins = await policy.list();
const bundle = await policy.load("soc2-readiness");
const verified = policy.verifyManifest(bundle, signed.manifest);
```

## API

### Validation and discovery

| Function | Returns | Description |
| --- | --- | --- |
| `policySchema` | `z.ZodType<PolicyBundle>` | Canonical bundle schema. Severity must match the deterministic-rule catalog. |
| `validatePolicy(input)` | `PolicyBundle` | Throws a Zod error on the first violation. |
| `loadPolicy(ref)` | `PolicyBundle` | Load by policy `id`, file path, or built-in name. |
| `loadPolicyFromPath(absolutePath)` | `PolicyBundle` | Load from an absolute file path. |
| `listBuiltinPolicies()` | `PolicyIdentity[]` | Enumerate the policies shipped under `policies/`. |
| `hashPolicy(bundle)` | `string` | Canonical SHA-256 hash used by the signed manifest. |

### Rule introspection

| Function | Returns | Description |
| --- | --- | --- |
| `getRequiredRuleIds(bundle)` | `GraderRuleId[]` | The `requiredRuleIds` array. |
| `getRulesBySeverity(bundle, severity)` | `PolicyBundle["rules"]` | Filter rules by severity. |
| `getCriticalRules(bundle)` | `PolicyBundle["rules"]` | All `Critical` rules. |
| `getRuleBindings(bundle)` | `RuleBinding[]` | Per-rule `{ ruleId, severity, title, objective, splunkRefs, required }`. |

### Mission binding

| Function | Returns | Description |
| --- | --- | --- |
| `bindPolicyToMission(bundle, mission)` | `PolicyMissionBinding` | `compatible`, `activeRuleIds`, `requiredButInactive`, `missionRulesNotInPolicy`. |
| `checkPolicyCompatibility(bundle, mission, { throwOnIncompatible? })` | `PolicyMissionBinding` | Throws `validatePolicyForMission` on gap by default. Set `throwOnIncompatible: false` to get a binding only. |

### Signing and verification

| Function | Returns | Description |
| --- | --- | --- |
| `signPolicy({ policyRef, outDir, privateKeyPath?, publicKeyPath? })` | `{ policy, manifest, artifacts }` | Writes `policy-manifest.json` and returns the signed bundle. |
| `verifyPolicyManifest(bundle, manifest)` | `SignedPolicyManifest` | Re-validates the signature; sets `signature.status` to `VERIFIED` or `INVALID`. |

## Built-In Bundles

| ID | Compliance framing |
| --- | --- |
| `default-readiness` | Baseline Splunk-ready agent certification. |
| `soc2-readiness` | SOC2-oriented framing for evidence-cited audit investigations. |
| `pci-dss-readiness` | PCI DSS-oriented framing for bounded, sensitive-data investigations. |

The three bundles share the same 18-rule deterministic core and the same 11
required rule IDs; only the `objective` and `splunkRefs` differ. The deterministic
rule engine stays authoritative regardless of which bundle is selected.

## Type Surface

```ts
import type {
  PolicyBundle,
  PolicyIdentity,
  SignedPolicyManifest,
  PolicyMissionBinding,
  PolicySdk
} from "splunkready/policy";
```

`PolicySdk` is the type of the `policy` namespace object, so downstream
consumers can type their own wrappers.
