import { readFile, readdir } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { canonicalJson, hashBuffer } from "../receipts/hash.js";
import {
  loadPolicyBundle,
  policyBundleSchema,
  policyIdentityFor,
  publishPolicy,
  signedPolicyManifestSchema,
  validatePolicyForMission,
  verifySignedPolicyManifest
} from "../policies/registry.js";
import type { GraderRuleId, Mission, Severity } from "../schemas/core.js";
import type { PolicyBundle, PolicyIdentity, SignedPolicyManifest } from "../policies/registry.js";

export {
  policyBundleSchema,
  signedPolicyManifestSchema,
  loadPolicyBundle,
  publishPolicy,
  verifySignedPolicyManifest
} from "../policies/registry.js";

export type { PolicyBundle, SignedPolicyManifest, PolicyIdentity };

const policyObjectSchema = policyBundleSchema;

const listPolicyDirectoryCandidates = (): string[] => {
  const directories = ["policies"];
  let currentDir = dirname(fileURLToPath(import.meta.url));

  while (true) {
    directories.push(join(currentDir, "policies"));
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return [...new Set(directories)];
};

const readPolicyFromDisk = async (policyPath: string): Promise<PolicyBundle> =>
  policyObjectSchema.parse(JSON.parse(await readFile(policyPath, "utf8")) as unknown);

export const validatePolicy = (input: unknown): PolicyBundle => policyObjectSchema.parse(input);

export const loadPolicy = async (policyRef: string): Promise<PolicyBundle> => {
  const { policy } = await loadPolicyBundle(policyRef);
  return policy;
};

export const loadPolicyFromPath = async (policyPath: string): Promise<PolicyBundle> => {
  if (!isAbsolute(policyPath)) {
    throw new Error(`Policy path must be absolute: ${policyPath}`);
  }
  return readPolicyFromDisk(policyPath);
};

export const listBuiltinPolicies = async (): Promise<PolicyIdentity[]> => {
  const identities: PolicyIdentity[] = [];
  const seen = new Set<string>();

  for (const directory of listPolicyDirectoryCandidates()) {
    const entries = await readdir(directory).catch(() => []);
    for (const entry of entries) {
      if (!entry.endsWith(".policy.json")) {
        continue;
      }
      const candidate = join(directory, entry);
      try {
        const policy = await readPolicyFromDisk(candidate);
        if (seen.has(policy.id)) {
          continue;
        }
        seen.add(policy.id);
        identities.push(policyIdentityFor(policy, hashPolicy(policy)));
      } catch {
        // Ignore directories that contain non-policy JSON files; the schema
        // parse failure is the only signal we have for "not a policy file".
      }
    }
  }

  return identities.sort((a, b) => a.id.localeCompare(b.id));
};

export const hashPolicy = (policy: PolicyBundle): string =>
  hashBuffer(Buffer.from(canonicalJson(policy), "utf8"));

export const getRequiredRuleIds = (policy: PolicyBundle): readonly GraderRuleId[] =>
  Object.freeze([...policy.requiredRuleIds]);

export const getRulesBySeverity = (policy: PolicyBundle, severity: Severity): PolicyBundle["rules"] =>
  policy.rules.filter((rule) => rule.severity === severity);

export const getCriticalRules = (policy: PolicyBundle): PolicyBundle["rules"] =>
  getRulesBySeverity(policy, "Critical");

export const getRuleBindings = (policy: PolicyBundle): Array<{
  ruleId: GraderRuleId;
  severity: Severity | undefined;
  title: string;
  objective: string;
  splunkRefs: readonly string[];
  required: boolean;
}> =>
  policy.rules.map((rule) => ({
    ruleId: rule.id,
    severity: rule.severity,
    title: rule.title,
    objective: rule.objective,
    splunkRefs: Object.freeze([...(rule.splunkRefs ?? [])]),
    required: policy.requiredRuleIds.includes(rule.id)
  }));

export interface PolicyMissionBinding {
  readonly policyId: string;
  readonly missionId: string;
  readonly activeRuleIds: readonly GraderRuleId[];
  readonly requiredRuleIds: readonly GraderRuleId[];
  readonly requiredButInactive: readonly GraderRuleId[];
  readonly missionRulesNotInPolicy: readonly GraderRuleId[];
  readonly compatible: boolean;
}

export const bindPolicyToMission = (policy: PolicyBundle, mission: Mission): PolicyMissionBinding => {
  const policyRuleIds = new Set<GraderRuleId>(policy.rules.map((rule) => rule.id));
  const missionRuleIds = new Set<GraderRuleId>(mission.checks);

  const activeRuleIds: GraderRuleId[] = [];
  const requiredButInactive: GraderRuleId[] = [];
  const missionRulesNotInPolicy: GraderRuleId[] = [];

  for (const ruleId of policy.requiredRuleIds) {
    if (missionRuleIds.has(ruleId)) {
      activeRuleIds.push(ruleId);
    } else {
      requiredButInactive.push(ruleId);
    }
  }

  for (const ruleId of mission.checks) {
    if (!policyRuleIds.has(ruleId)) {
      missionRulesNotInPolicy.push(ruleId);
    }
  }

  return {
    policyId: policy.id,
    missionId: mission.id,
    activeRuleIds: Object.freeze(activeRuleIds),
    requiredRuleIds: Object.freeze([...policy.requiredRuleIds]),
    requiredButInactive: Object.freeze(requiredButInactive),
    missionRulesNotInPolicy: Object.freeze(missionRulesNotInPolicy),
    compatible: requiredButInactive.length === 0 && missionRulesNotInPolicy.length === 0
  };
};

export interface PolicyCompatibilityCheckOptions {
  readonly throwOnIncompatible?: boolean;
}

export const checkPolicyCompatibility = (
  policy: PolicyBundle,
  mission: Mission,
  options: PolicyCompatibilityCheckOptions = { throwOnIncompatible: true }
): PolicyMissionBinding => {
  const binding = bindPolicyToMission(policy, mission);
  if (options.throwOnIncompatible && !binding.compatible) {
    validatePolicyForMission(policy, mission);
  }
  return binding;
};

export const signPolicy = async (input: {
  policyRef: string;
  outDir?: string;
  privateKeyPath?: string;
  publicKeyPath?: string;
}): Promise<{ policy: PolicyBundle; manifest: SignedPolicyManifest; artifacts: string[] }> =>
  publishPolicy(input);

export const verifyPolicyManifest = (
  policy: PolicyBundle,
  manifest: SignedPolicyManifest
): SignedPolicyManifest => verifySignedPolicyManifest(policy, manifest);

export const policySchema = policyObjectSchema;

export const policy = {
  schema: policyObjectSchema,
  load: loadPolicy,
  loadFromPath: loadPolicyFromPath,
  list: listBuiltinPolicies,
  validate: validatePolicy,
  hash: hashPolicy,
  requiredRuleIds: getRequiredRuleIds,
  rulesBySeverity: getRulesBySeverity,
  criticalRules: getCriticalRules,
  bindings: getRuleBindings,
  bindToMission: bindPolicyToMission,
  checkCompatibility: checkPolicyCompatibility,
  sign: signPolicy,
  verifyManifest: verifyPolicyManifest
} as const;

export type PolicySdk = typeof policy;
