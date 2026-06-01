import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const inboxDir = process.argv[2] ?? "logs/reviewer-inbox";

const reviewerFilePattern = /^(wave-(\d+)|unknown-wave)-.*\.md$/;
const verdictPattern = /^## Verdict\s*\n\s*-\s*(.+)$/m;

const latestByGroup = new Map();

for (const name of readdirSync(inboxDir)) {
  const match = name.match(reviewerFilePattern);
  if (!match) {
    continue;
  }

  const group = match[2] ? `wave-${String(Number(match[2])).padStart(2, "0")}` : "unknown-wave";
  const previous = latestByGroup.get(group);

  if (!previous || name > previous.name) {
    latestByGroup.set(group, { name, file: join(inboxDir, name) });
  }
}

const blockers = [];
const concerns = [];
const orderedGroups = [...latestByGroup.keys()].sort((left, right) => {
  if (left === "unknown-wave") return 1;
  if (right === "unknown-wave") return -1;
  return Number(left.slice(5)) - Number(right.slice(5));
});

for (const group of orderedGroups) {
  const { name, file } = latestByGroup.get(group);
  const text = readFileSync(file, "utf8");
  const verdict = text.match(verdictPattern)?.[1]?.trim();

  if (!verdict) {
    const unparseableVerdict = "unparseable";
    blockers.push({ group, name, verdict: unparseableVerdict });
    console.log(`${group} ${unparseableVerdict} ${name}`);
    continue;
  }

  if (/^fail\b/i.test(verdict)) {
    blockers.push({ group, name, verdict });
  }

  if (/concerns/i.test(verdict)) {
    concerns.push({ group, name, verdict });
  }

  console.log(`${group} ${verdict} ${name}`);
}

if (blockers.length > 0) {
  console.error(JSON.stringify({ blockers }, null, 2));
  process.exit(1);
}

console.log(
  `PASS reviewer inbox audited (${latestByGroup.size} groups, ${concerns.length} pass-with-concerns files, 0 failing latest verdicts)`
);
