#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

require_file() {
  [[ -s "$1" ]] || fail "missing or empty file: $1"
}

required_root=(
  "AGENTS.md"
  "MANIFEST.md"
  "PLAN.md"
  "DECISIONS.md"
  "ARCHITECTURE.md"
  "QUALITY-BAR.md"
  "docs/product-brief.md"
  "docs/demo-story.md"
  "docs/domain-glossary.md"
  "docs/implementation-handoff.md"
  "docs/stack-recommendation.md"
  "docs/scaffold-confidence.md"
  "docs/verification-matrix.md"
  "docs/demo-acceptance-criteria.md"
  "docs/golden-traces.md"
  "docs/grader-rule-catalog.md"
  "docs/fixture-live-parity.md"
  "docs/demo-script.md"
  "docs/prompts/README.md"
  "docs/prompts/main-executor-goal.md"
  "docs/prompts/reviewer-goal.md"
  "docs/waves/README.md"
  "docs/waves/WAVE-CONTRACT.md"
  "docs/reviewer/REVIEWER_LOOP.md"
  "docs/reviewer/checklists.md"
  "docs/reviewer/severity-rubric.md"
  "docs/schemas/README.md"
  "docs/schemas/core-contracts.md"
  "docs/skills/README.md"
  "docs/skills/SKILL_AUTHORING.md"
  "references/context-map.md"
  "references/source-grounding-matrix.md"
  "references/openai-codex-nomenclature.md"
  "logs/execution-log.md"
  "logs/reviewer-notes.md"
  "logs/risk-register.md"
  "logs/decision-log.md"
  "logs/verification-log.md"
  "logs/reviewer-inbox/README.md"
)

for file in "${required_root[@]}"; do
  require_file "$file"
done

wave_count="$(find docs/waves -maxdepth 1 -type f -name 'wave-*.md' | wc -l | tr -d ' ')"
[[ "$wave_count" -eq 42 ]] || fail "expected 42 wave files, found $wave_count"

for i in $(seq -w 0 41); do
  require_file "docs/waves/wave-${i}-"*.md
done

required_terms=(
  "SplunkReady"
  "Agent Readiness Compiler"
  "Readiness Receipt"
  "fixture mode"
  "live mode"
  "deterministic"
  "Specimen Agent"
  "Agent Skill"
  "TypeScript"
  "source grounding"
  "severity"
  "Golden Trace"
  "SPL-001"
  "fixture/live parity"
  "3-minute"
  "splunkready-build"
  "reviewer-inbox"
  "agy --dangerously-skip-permissions"
)

for term in "${required_terms[@]}"; do
  rg -q "$term" . || fail "required term not found: $term"
done

for file in docs/waves/wave-*.md; do
  rg -q "^## Goal" "$file" || fail "$file missing Goal"
  rg -q "^## Scope" "$file" || fail "$file missing Scope"
  rg -q "^## Acceptance Criteria" "$file" || fail "$file missing Acceptance Criteria"
  rg -q "^## Verification" "$file" || fail "$file missing Verification"
  rg -q "^## Reviewer Checklist" "$file" || fail "$file missing Reviewer Checklist"
  rg -q "^## Stop Conditions" "$file" || fail "$file missing Stop Conditions"
done

if rg -n "hardcoded to fail/pass|LLM-Judging-LLM|auto-mutate Splunk" AGENTS.md DECISIONS.md QUALITY-BAR.md logs/risk-register.md >/dev/null; then
  :
else
  fail "core anti-slop guardrails missing"
fi

rg -q "Weighted result: 95/100" docs/scaffold-confidence.md || fail "scaffold confidence not updated to 95/100"
rg -q "Official Splunk Sources" references/source-grounding-matrix.md || fail "source grounding matrix missing official Splunk sources"
rg -q "Official OpenAI/Codex Sources" references/source-grounding-matrix.md || fail "source grounding matrix missing OpenAI/Codex sources"
rg -q "Critical" docs/reviewer/severity-rubric.md || fail "reviewer severity rubric missing Critical"
rg -q "Fixture adapter" docs/verification-matrix.md || fail "verification matrix missing implementation checks"
rg -q "Naive Lateral Movement Failure" docs/golden-traces.md || fail "golden traces missing naive failure"
rg -q "LLMs must not be used" docs/grader-rule-catalog.md || fail "grader catalog missing LLM boundary"
rg -q "Shared Interface Rule" docs/fixture-live-parity.md || fail "fixture/live parity missing shared interface"
rg -q "0:00-0:15" docs/demo-script.md || fail "demo script missing timing beats"
rg -q "^/goal" docs/prompts/main-executor-goal.md || fail "main executor prompt missing /goal"
rg -q "^/goal" docs/prompts/reviewer-goal.md || fail "reviewer prompt missing /goal"
rg -q "one commit per completed wave" docs/prompts/main-executor-goal.md || fail "main prompt missing commit protocol"
rg -q "Do not commit" docs/prompts/reviewer-goal.md || fail "reviewer prompt missing no-commit rule"
rg -q "logs/reviewer-inbox/" docs/prompts/reviewer-goal.md || fail "reviewer prompt missing inbox path"

echo "PASS: scaffold verified"
echo "waves: $wave_count"
echo "project files: $(find . \( -path './.git' -o -path './node_modules' -o -path './dist' -o -path './coverage' \) -prune -o -type f -print | wc -l | tr -d ' ')"
