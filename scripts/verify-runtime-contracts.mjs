import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const fail = (message, evidence = {}) => {
  console.error(JSON.stringify({ status: "FAIL", message, evidence }, null, 2));
  process.exit(1);
};

const readText = (path) => readFileSync(join(root, path), "utf8");
const readJson = (path) => JSON.parse(readText(path));
const unique = (values) => [...new Set(values)];

const extractEnumValues = (source, name) => {
  const match = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*z\\.enum\\(\\[([\\s\\S]*?)\\]\\)`).exec(source);

  if (!match) {
    fail(`Unable to locate ${name}.`);
  }

  return unique([...match[1].matchAll(/"([^"]+)"/g)].map((matchValue) => matchValue[1])).sort();
};

const diffSets = (left, right) => ({
  missing: left.filter((value) => !right.includes(value)),
  extra: right.filter((value) => !left.includes(value))
});

const assertSameSet = (label, expected, actual) => {
  const diff = diffSets(expected, actual);

  if (diff.missing.length > 0 || diff.extra.length > 0) {
    fail(`${label} set mismatch.`, { expected, actual, ...diff });
  }
};

const coreSource = readText("src/schemas/core.ts");
const engineSource = readText("src/grader/engine.ts");
const certificationActionsSource = readText("src/workflows/certification-actions.ts");
const canonicalRuleIds = extractEnumValues(coreSource, "graderRuleIdSchema");
const readOnlyTools = extractEnumValues(coreSource, "readOnlySplunkToolNameSchema");
const catalogRuleIds = unique([...readText("docs/grader-rule-catalog.md").matchAll(/`([A-Z]{2,3}-\d{3})`/g)].map((match) => match[1])).sort();
const severityRuleIds = unique([...engineSource.matchAll(/"([A-Z]{2,3}-\d{3})"\s*:/g)].map((match) => match[1])).sort();
const graderFiles = readdirSync(join(root, "src/grader"))
  .filter((name) => name.endsWith(".ts") && !["engine.ts", "scoring.ts"].includes(name))
  .map((name) => `src/grader/${name}`);
const implementedRuleIds = graderFiles.flatMap((path) =>
  [...readText(path).matchAll(/^\s*id:\s*"([A-Z]{2,3}-\d{3})"/gm)].map((match) => match[1])
);
const duplicateImplementedRules = implementedRuleIds.filter((ruleId, index) => implementedRuleIds.indexOf(ruleId) !== index);
const ruleFactoryNames = graderFiles.flatMap((path) =>
  [...readText(path).matchAll(/export\s+const\s+(create[A-Z]\w+Rules)\s*=/g)].map((match) => match[1])
);
const allRulesBlock =
  /const\s+allRules\s*=\s*\(\)\s*:\s*GraderRule\[\]\s*=>\s*\[([\s\S]*?)\];/.exec(certificationActionsSource)?.[1] ?? "";
const missingAllRulesFactories = ruleFactoryNames.filter((factoryName) => !allRulesBlock.includes(`${factoryName}()`));

assertSameSet("Catalog rule id", canonicalRuleIds, catalogRuleIds);
assertSameSet("Severity registry rule id", canonicalRuleIds, severityRuleIds);
assertSameSet("Implemented grader rule id", canonicalRuleIds, unique(implementedRuleIds).sort());

if (duplicateImplementedRules.length > 0) {
  fail("Duplicate grader rule implementation IDs.", { duplicateImplementedRules });
}

if (missingAllRulesFactories.length > 0) {
  fail("Certification action allRules registry does not include every grader rule factory.", { missingAllRulesFactories });
}

const fixturePath = "fixtures/acme-soc-dev/adapter-fixture.json";
const fixture = readJson(fixturePath);
const fixtureIndexes = new Set((fixture.indexes ?? []).map((index) => index.name));
const fixtureKnowledgeIds = new Set((fixture.knowledgeObjects ?? []).map((object) => object.id));
const fixtureSavedSearchRefs = new Set(
  (fixture.knowledgeObjects ?? [])
    .filter((object) => object.type === "saved_searches")
    .map((object) => `${object.app}::${object.name}`)
);
const fixtureEvidenceRefs = new Set([
  ...Object.values(fixture.queryResults ?? {}).flatMap((result) => result.evidenceRefs ?? []),
  ...Object.values(fixture.savedSearchResults ?? {}).flatMap((result) => result.evidenceRefs ?? [])
]);

if (fixture.mode !== "fixture") {
  fail("Adapter fixture must declare fixture mode.", { fixturePath, mode: fixture.mode });
}

assertSameSet("Fixture read-only tool", [...fixture.readOnlyTools].sort(), [...fixture.readOnlyTools].filter((tool) => readOnlyTools.includes(tool)).sort());

const mutatingTools = (fixture.readOnlyTools ?? []).filter((tool) => /\b(?:write|delete|update|create|mutate|collect|outputlookup)\b/i.test(tool));
if (mutatingTools.length > 0) {
  fail("Fixture exposes mutating tools.", { mutatingTools });
}

const duplicateIndexes = (fixture.indexes ?? [])
  .map((index) => index.name)
  .filter((indexName, index, all) => all.indexOf(indexName) !== index);
if (duplicateIndexes.length > 0) {
  fail("Fixture declares duplicate indexes.", { duplicateIndexes });
}

const missingKnowledgeDependencies = (fixture.knowledgeObjects ?? []).flatMap((object) =>
  (object.dependsOn ?? [])
    .filter((dependency) => !fixtureKnowledgeIds.has(dependency))
    .map((dependency) => ({ object: object.id, dependency }))
);
if (missingKnowledgeDependencies.length > 0) {
  fail("Fixture knowledge object dependency missing.", { missingKnowledgeDependencies });
}

const missionDir = "fixtures/acme-soc-dev/missions";
const missionPaths = readdirSync(join(root, missionDir))
  .filter((name) => name.endsWith("-readiness.json"))
  .map((name) => `${missionDir}/${name}`)
  .sort();
const missions = missionPaths.map((path) => ({ path, mission: readJson(path) }));
const duplicateMissionIds = missions
  .map(({ mission }) => mission.id)
  .filter((missionId, index, all) => all.indexOf(missionId) !== index);

if (duplicateMissionIds.length > 0) {
  fail("Fixture missions declare duplicate IDs.", { duplicateMissionIds });
}

const missionFailures = [];
for (const { path, mission } of missions) {
  for (const ruleId of mission.checks ?? []) {
    if (!canonicalRuleIds.includes(ruleId)) {
      missionFailures.push({ path, field: "checks", value: ruleId });
    }
  }

  for (const tool of [...(mission.expectedTools ?? []), ...(mission.allowedTools ?? [])]) {
    if (!readOnlyTools.includes(tool)) {
      missionFailures.push({ path, field: "tools", value: tool });
    }
  }

  for (const indexName of mission.authorizedIndexes ?? []) {
    if (!fixtureIndexes.has(indexName)) {
      missionFailures.push({ path, field: "authorizedIndexes", value: indexName });
    }
  }

  for (const ref of mission.preferredSavedSearchRefs ?? []) {
    if (!fixtureSavedSearchRefs.has(ref)) {
      missionFailures.push({ path, field: "preferredSavedSearchRefs", value: ref });
    }
  }

  for (const fixtureRef of mission.fixtures ?? []) {
    const normalized = normalize(fixtureRef);
    const fixtureFile = join(root, normalized);
    const isExistingFile = normalized.startsWith("fixtures/") && existsSync(fixtureFile) && statSync(fixtureFile).isFile();
    const isEvidenceRef = fixtureEvidenceRefs.has(fixtureRef);
    const isFixtureQueryRef = Object.values(fixture.queryResults ?? {}).some((result) => result.queryRef === fixtureRef);

    if (!isExistingFile && !isEvidenceRef && !isFixtureQueryRef && !fixtureRef.includes(":")) {
      missionFailures.push({ path, field: "fixtures", value: fixtureRef });
    }
  }
}

if (missionFailures.length > 0) {
  fail("Fixture mission provenance check failed.", { missionFailures });
}

const suiteDir = "fixtures/acme-soc-dev/suites";
const suiteFailures = [];
for (const name of readdirSync(join(root, suiteDir)).filter((entry) => entry.endsWith(".json"))) {
  const suitePath = `${suiteDir}/${name}`;
  const suite = readJson(suitePath);
  const baseDir = dirname(suitePath);

  for (const missionPath of suite.missionPaths ?? []) {
    const resolvedPath = normalize(join(baseDir, missionPath));

    if (!existsSync(join(root, resolvedPath))) {
      suiteFailures.push({ suitePath, missionPath });
    }
  }
}

if (suiteFailures.length > 0) {
  fail("Fixture suite references missing mission files.", { suiteFailures });
}

console.log(
  `PASS runtime contracts verified (${canonicalRuleIds.length} rules, ${missions.length} fixture missions, ${fixtureEvidenceRefs.size} evidence refs)`
);
