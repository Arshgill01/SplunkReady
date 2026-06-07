import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseMissionDefinition } from "../../src/missions/dsl.js";
import {
  loadPolicyBundle,
  policyIdentityFor,
  publishPolicy,
  validatePolicyForMission,
  verifySignedPolicyManifest
} from "../../src/policies/registry.js";

describe("signed policy registry", () => {
  it("loads, signs, verifies, and binds a policy bundle to the default mission", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-policy-registry-"));
    const { policy } = await loadPolicyBundle("pci-dss-readiness");
    const mission = parseMissionDefinition(
      JSON.parse(await readFile("fixtures/acme-soc-dev/missions/security-investigation-readiness.json", "utf8")) as unknown
    );
    const published = await publishPolicy({ policyRef: "pci-dss-readiness", outDir });
    const verified = verifySignedPolicyManifest(policy, published.manifest);

    validatePolicyForMission(policy, mission);

    expect(published.artifacts).toContain(join(outDir, "pci-dss-readiness.policy-manifest.json"));
    expect(published.manifest).toMatchObject({
      source: "splunkready-policy-registry",
      policy: { id: "pci-dss-readiness", version: "2026.06.07" },
      deterministicAuthority: true,
      mutation: false,
      signature: { algorithm: "ed25519", signedPayload: "policyHash", status: "SIGNED" }
    });
    expect(verified.signature.status).toBe("VERIFIED");
    expect(policyIdentityFor(policy, published.manifest.policyHash)).toMatchObject({
      id: "pci-dss-readiness",
      name: "PCI DSS Splunk Agent Readiness",
      version: "2026.06.07",
      hash: expect.stringMatching(/^[a-f0-9]{64}$/)
    });
  });

  it("fails closed when a policy does not allow an active mission rule", async () => {
    const { policy } = await loadPolicyBundle("soc2-readiness");
    const mission = parseMissionDefinition(
      JSON.parse(await readFile("fixtures/acme-soc-dev/missions/security-investigation-readiness.json", "utf8")) as unknown
    );

    expect(() =>
      validatePolicyForMission(
        {
          ...policy,
          rules: policy.rules.filter((rule) => rule.id !== "SAF-003")
        },
        mission
      )
    ).toThrow("does not allow mission rule(s): SAF-003");
  });
});
