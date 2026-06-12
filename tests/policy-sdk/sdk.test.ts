import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseMissionDefinition } from "../../src/missions/dsl.js";
import { readFileSync } from "node:fs";

import {
  bindPolicyToMission,
  checkPolicyCompatibility,
  getCriticalRules,
  getRequiredRuleIds,
  getRuleBindings,
  hashPolicy,
  listBuiltinPolicies,
  loadPolicy,
  policy,
  policySchema,
  signPolicy,
  validatePolicy,
  verifyPolicyManifest
} from "../../src/policy-sdk/index.js";

const loadMission = (missionPath: string) =>
  parseMissionDefinition(JSON.parse(readFileSync(missionPath, "utf8")) as unknown);

describe("policy-sdk surface", () => {
  it("loads the bundled default policy and validates its schema", async () => {
    const bundle = await loadPolicy("default-readiness");

    expect(validatePolicy(bundle)).toEqual(bundle);
    expect(policySchema.parse(bundle)).toEqual(bundle);
  });

  it("lists the three built-in policies with stable identities", async () => {
    const identities = await listBuiltinPolicies();

    expect(identities.map((entry) => entry.id)).toEqual([
      "default-readiness",
      "pci-dss-readiness",
      "soc2-readiness"
    ]);
    for (const identity of identities) {
      expect(identity.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(identity.version).toBe("2026.06.07");
    }
  });

  it("exposes deterministic required rule IDs and critical rules", async () => {
    const bundle = await loadPolicy("pci-dss-readiness");

    expect(getRequiredRuleIds(bundle)).toContain("SPL-001");
    expect(getRequiredRuleIds(bundle)).toContain("SAF-003");
    expect(getCriticalRules(bundle).map((rule) => rule.id)).toEqual(
      expect.arrayContaining(["SPL-001", "SPL-003", "EVD-001", "ANS-001", "SAF-001", "SAF-003"])
    );
  });

  it("returns rule bindings with severity and required flags", async () => {
    const bundle = await loadPolicy("default-readiness");
    const bindings = getRuleBindings(bundle);

    expect(bindings.length).toBe(bundle.rules.length);
    const spl001 = bindings.find((entry) => entry.ruleId === "SPL-001");
    expect(spl001?.severity).toBe("Critical");
    expect(spl001?.required).toBe(true);
  });

  it("binds a policy to a mission and reports required-but-inactive and mission-not-in-policy gaps", async () => {
    const bundle = await loadPolicy("default-readiness");
    const binding = bindPolicyToMission(bundle, loadMission("fixtures/acme-soc-dev/missions/security-investigation-readiness.json"));

    expect(binding.policyId).toBe("default-readiness");
    expect(binding.missionId).toBe("mission-security-lateral-movement-readiness");
    expect(binding.activeRuleIds.length).toBeGreaterThan(0);
    expect(binding.compatible).toBe(true);
    expect(binding.requiredButInactive).toEqual([]);
    expect(binding.missionRulesNotInPolicy).toEqual([]);
  });

  it("throws when compatibility is requested and the mission activates a rule the policy does not allow", async () => {
    const bundle = await loadPolicy("default-readiness");
    const truncated = { ...bundle, rules: bundle.rules.filter((rule) => rule.id !== "SAF-003") };

    expect(() => checkPolicyCompatibility(truncated, loadMission("fixtures/acme-soc-dev/missions/security-investigation-readiness.json"))).toThrow();
    expect(() =>
      checkPolicyCompatibility(truncated, loadMission("fixtures/acme-soc-dev/missions/security-investigation-readiness.json"), {
        throwOnIncompatible: false
      })
    ).not.toThrow();
  });

  it("signs a policy and verifies the manifest signature", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-policy-sdk-"));
    const bundle = await loadPolicy("soc2-readiness");
    const signed = await signPolicy({ policyRef: "soc2-readiness", outDir });

    expect(signed.policy.id).toBe("soc2-readiness");
    expect(signed.manifest.source).toBe("splunkready-policy-registry");
    expect(signed.manifest.signature.status).toBe("SIGNED");
    expect(signed.manifest.policyHash).toBe(hashPolicy(bundle));
    expect(verifyPolicyManifest(bundle, signed.manifest).signature.status).toBe("VERIFIED");
  });

  it("exposes a single policy namespace with the same functions", () => {
    expect(policy.schema).toBe(policySchema);
    expect(policy.load).toBe(loadPolicy);
    expect(policy.validate).toBe(validatePolicy);
    expect(policy.sign).toBe(signPolicy);
    expect(policy.bindToMission).toBe(bindPolicyToMission);
  });
});
