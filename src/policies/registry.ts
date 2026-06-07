import { generateKeyPairSync, sign as signData, verify as verifyData } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { ruleSeverityById, type GraderRuleId } from "../grader/engine.js";
import { canonicalJson, hashBuffer } from "../receipts/hash.js";
import { graderRuleIdSchema, severitySchema, type Mission, type ReadinessReceipt } from "../schemas/core.js";

const idSchema = z.string().min(1);
const sha256HexSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const policyRuleSchema = z
  .object({
    id: graderRuleIdSchema,
    title: z.string().min(1),
    objective: z.string().min(1),
    severity: severitySchema.optional(),
    splunkRefs: z.array(z.string().min(1)).optional()
  })
  .strict();

export const policyBundleSchema = z
  .object({
    schemaVersion: z.literal("splunkready.policy/v1"),
    id: idSchema,
    name: z.string().min(1),
    version: z.string().min(1),
    description: z.string().min(1),
    requiredRuleIds: z.array(graderRuleIdSchema).min(1),
    rules: z.array(policyRuleSchema).min(1),
    tags: z.array(z.string().min(1)).optional()
  })
  .strict()
  .superRefine((policy, ctx) => {
    const seen = new Set<string>();
    const ruleIds = new Set(policy.rules.map((rule) => rule.id));

    for (const rule of policy.rules) {
      if (seen.has(rule.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["rules"], message: `Duplicate policy rule ${rule.id}.` });
      }
      seen.add(rule.id);

      if (rule.severity && rule.severity !== ruleSeverityById[rule.id]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rules", rule.id, "severity"],
          message: `Policy rule ${rule.id} severity must match canonical ${ruleSeverityById[rule.id]}.`
        });
      }
    }

    for (const requiredRuleId of policy.requiredRuleIds) {
      if (!ruleIds.has(requiredRuleId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["requiredRuleIds"],
          message: `Required rule ${requiredRuleId} is missing from policy rules.`
        });
      }
    }
  });

export const signedPolicyManifestSchema = z
  .object({
    source: z.literal("splunkready-policy-registry"),
    policy: z.object({ id: idSchema, name: z.string().min(1), version: z.string().min(1) }).strict(),
    policyPath: z.string().min(1),
    policyHash: sha256HexSchema,
    signature: z
      .object({
        algorithm: z.literal("ed25519"),
        signedPayload: z.literal("policyHash"),
        status: z.enum(["SIGNED", "VERIFIED", "INVALID"]),
        signatureBase64: z.string().min(1),
        publicKeyPem: z.string().min(1),
        publicKeySha256: sha256HexSchema
      })
      .strict(),
    deterministicAuthority: z.literal(true),
    mutation: z.literal(false)
  })
  .strict();

export type PolicyBundle = z.infer<typeof policyBundleSchema>;
export type SignedPolicyManifest = z.infer<typeof signedPolicyManifestSchema>;
export type PolicyIdentity = NonNullable<ReadinessReceipt["policy"]>;

export interface PolicyPublishResult {
  policy: PolicyBundle;
  manifest: SignedPolicyManifest;
  artifacts: string[];
}

export interface PolicyInstallResult {
  policy: PolicyBundle;
  manifest: SignedPolicyManifest;
  artifacts: string[];
}

const exists = async (filePath: string): Promise<boolean> =>
  stat(filePath)
    .then(() => true)
    .catch(() => false);

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const hashPolicy = (policy: PolicyBundle): string => hashBuffer(Buffer.from(canonicalJson(policy), "utf8"));

const verifySignature = (policyHash: string, publicKeyPem: string, signatureBase64: string): boolean =>
  verifyData(null, Buffer.from(policyHash, "utf8"), publicKeyPem, Buffer.from(signatureBase64, "base64"));

const signPolicyHash = async (
  policyHash: string,
  keys?: { privateKeyPath?: string; publicKeyPath?: string }
): Promise<SignedPolicyManifest["signature"]> => {
  if (keys?.privateKeyPath && keys.publicKeyPath) {
    const [privateKeyPem, publicKeyPem] = await Promise.all([
      readFile(keys.privateKeyPath, "utf8"),
      readFile(keys.publicKeyPath, "utf8")
    ]);
    const signatureBase64 = signData(null, Buffer.from(policyHash, "utf8"), privateKeyPem).toString("base64");
    const verified = verifySignature(policyHash, publicKeyPem, signatureBase64);

    return {
      algorithm: "ed25519",
      signedPayload: "policyHash",
      status: verified ? "SIGNED" : "INVALID",
      signatureBase64,
      publicKeyPem,
      publicKeySha256: hashBuffer(Buffer.from(publicKeyPem, "utf8"))
    };
  }

  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" }).toString();
  const signatureBase64 = signData(null, Buffer.from(policyHash, "utf8"), privateKey).toString("base64");

  return {
    algorithm: "ed25519",
    signedPayload: "policyHash",
    status: "SIGNED",
    signatureBase64,
    publicKeyPem,
    publicKeySha256: hashBuffer(Buffer.from(publicKeyPem, "utf8"))
  };
};

const candidatePolicyPaths = (policyRef: string): string[] => {
  const normalizedRef = policyRef.endsWith(".policy.json") ? policyRef : `${policyRef}.policy.json`;
  const direct = [policyRef, normalizedRef, join("policies", normalizedRef)];
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const upward: string[] = [];
  let currentDir = moduleDir;

  while (true) {
    upward.push(join(currentDir, "policies", normalizedRef));
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return [...direct, ...upward];
};

const policyDirectories = (): string[] => {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const directories = ["policies"];
  let currentDir = moduleDir;

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

const resolvePolicyById = async (policyRef: string): Promise<string | undefined> => {
  for (const directory of policyDirectories()) {
    const entries = await readdir(directory).catch(() => []);

    for (const entry of entries) {
      if (!entry.endsWith(".policy.json")) {
        continue;
      }

      const candidate = join(directory, entry);
      const parsed = policyBundleSchema.safeParse(JSON.parse(await readFile(candidate, "utf8")) as unknown);

      if (parsed.success && parsed.data.id === policyRef) {
        return candidate;
      }
    }
  }

  return undefined;
};

export const resolvePolicyPath = async (policyRef: string): Promise<string> => {
  if (!policyRef) {
    throw new Error("A policy name or path is required.");
  }

  if (isAbsolute(policyRef) && (await exists(policyRef))) {
    return policyRef;
  }

  for (const candidate of candidatePolicyPaths(policyRef)) {
    if (await exists(candidate)) {
      return candidate;
    }
  }

  const idMatch = await resolvePolicyById(policyRef);
  if (idMatch) {
    return idMatch;
  }

  throw new Error(`Policy not found: ${policyRef}. Use a path or a name from policies/*.policy.json.`);
};

export const loadPolicyBundle = async (policyRef: string): Promise<{ path: string; policy: PolicyBundle }> => {
  const path = await resolvePolicyPath(policyRef);
  const policy = policyBundleSchema.parse(JSON.parse(await readFile(path, "utf8")) as unknown);

  return { path, policy };
};

export const policyIdentityFor = (policy: PolicyBundle, policyHash: string): PolicyIdentity => ({
  id: policy.id,
  name: policy.name,
  version: policy.version,
  hash: policyHash
});

export const validatePolicyForMission = (policy: PolicyBundle, mission: Mission): void => {
  const allowedRuleIds = new Set<GraderRuleId>(policy.rules.map((rule) => rule.id));
  const missionRuleIds = new Set<GraderRuleId>(mission.checks);
  const missingMissionRules = mission.checks.filter((ruleId) => !allowedRuleIds.has(ruleId));
  const inactiveRequiredRules = policy.requiredRuleIds.filter((ruleId) => !missionRuleIds.has(ruleId));

  if (missingMissionRules.length > 0) {
    throw new Error(`Policy ${policy.id} does not allow mission rule(s): ${missingMissionRules.join(", ")}.`);
  }

  if (inactiveRequiredRules.length > 0) {
    throw new Error(`Mission ${mission.id} does not activate required policy rule(s): ${inactiveRequiredRules.join(", ")}.`);
  }
};

export const publishPolicy = async (input: {
  policyRef: string;
  outDir?: string;
  privateKeyPath?: string;
  publicKeyPath?: string;
}): Promise<PolicyPublishResult> => {
  const { path, policy } = await loadPolicyBundle(input.policyRef);
  const policyHash = hashPolicy(policy);
  const signature = await signPolicyHash(policyHash, {
    privateKeyPath: input.privateKeyPath,
    publicKeyPath: input.publicKeyPath
  });
  const manifest = signedPolicyManifestSchema.parse({
    source: "splunkready-policy-registry",
    policy: { id: policy.id, name: policy.name, version: policy.version },
    policyPath: relative(process.cwd(), path) || path,
    policyHash,
    signature,
    deterministicAuthority: true,
    mutation: false
  });
  const manifestPath = join(input.outDir ?? dirname(path), `${policy.id}.policy-manifest.json`);

  await writeJson(manifestPath, manifest);

  return { policy, manifest, artifacts: [manifestPath] };
};

export const installPolicy = async (input: {
  policyRef: string;
  outDir: string;
  privateKeyPath?: string;
  publicKeyPath?: string;
}): Promise<PolicyInstallResult> => {
  const published = await publishPolicy({
    policyRef: input.policyRef,
    outDir: join(input.outDir, "policy-registry"),
    privateKeyPath: input.privateKeyPath,
    publicKeyPath: input.publicKeyPath
  });
  const installDir = join(input.outDir, "policy-registry", published.policy.id);
  const policyPath = join(installDir, "policy.json");
  const manifestPath = join(installDir, "policy-manifest.json");

  await writeJson(policyPath, published.policy);
  await writeJson(manifestPath, published.manifest);
  await rm(published.artifacts[0], { force: true });

  return { policy: published.policy, manifest: published.manifest, artifacts: [policyPath, manifestPath] };
};

export const verifySignedPolicyManifest = (policy: PolicyBundle, manifest: SignedPolicyManifest): SignedPolicyManifest => {
  const policyHash = hashPolicy(policy);
  const verified =
    policyHash === manifest.policyHash &&
    verifySignature(policyHash, manifest.signature.publicKeyPem, manifest.signature.signatureBase64);

  return signedPolicyManifestSchema.parse({
    ...manifest,
    signature: {
      ...manifest.signature,
      status: verified ? "VERIFIED" : "INVALID"
    }
  });
};
