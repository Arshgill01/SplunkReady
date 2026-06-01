# Core Contracts

## EnvironmentContract

Required fields:

- `id`
- `name`
- `version`
- `generatedAt`
- `mode`
- `indexes`
- `restrictedIndexes`
- `sourcetypes`
- `canonicalFields`
- `macros`
- `lookups`
- `savedSearches`
- `dashboardPanels`
- `dataModels`
- `appContexts`
- `mcpTools`
- `queryBudgets`
- `evidenceRules`

## Mission

Required fields:

- `id`
- `title`
- `domain`
- `prompt`
- `expectedTools`
- `allowedTools`
- `forbiddenPatterns`
- `requiredEvidence`
- `checks`
- `severityWeights`

## TraceEvent

Required fields:

- `id`
- `timestamp`
- `actor`
- `toolName`
- `toolInput`
- `toolOutputSummary`
- `queryRef`
- `timeWindow`
- `resultCount`
- `evidenceRefs`
- `error`

## Violation

Required fields:

- `id`
- `missionId`
- `traceEventId`
- `ruleId`
- `severity`
- `reason`
- `evidence`
- `suggestedPolicyPatch`

Rule IDs must come from `docs/grader-rule-catalog.md`. New rule IDs require updating that catalog and at least one test or golden trace.

## ReadinessReceipt

Required fields:

- `id`
- `agent`
- `environment`
- `contractVersion`
- `missionSuiteVersion`
- `verdict`
- `score`
- `passedMissions`
- `failedMissions`
- `criticalViolations`
- `traceRefs`
- `policyPatchSummary`
- `rerunComparison`

Receipts must disclose fixture or live mode and must link critical violations to trace events.
