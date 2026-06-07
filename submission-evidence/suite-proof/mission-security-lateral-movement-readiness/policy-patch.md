# Policy Patch: patch-security-readiness

Source receipt: `receipt-before-001`
Target agent: Naive SOC MCP Agent 0.1.0
Status: exported

## Summary

Policy patch for receipt-before-001: addresses 5 observed violation(s) from verdict NOT READY.

## Violation Refs

- `violation-mission-security-lateral-movement-readiness-spl-001-mission-security-lateral-movement-readiness-trace-001`
- `violation-mission-security-lateral-movement-readiness-spl-003-mission-security-lateral-movement-readiness-trace-001`
- `violation-mission-security-lateral-movement-readiness-ko-001-mission-security-lateral-movement-readiness-trace-001`
- `violation-mission-security-lateral-movement-readiness-evd-001-mission-security-lateral-movement-readiness-trace-003`
- `violation-mission-security-lateral-movement-readiness-ans-001-mission-security-lateral-movement-readiness-trace-003`

## Rules

- `inject-contract-summary`: Use the compiled Splunk contract contract-acme-soc-dev version 2026.06.01 in fixture mode. Allowed read-only tools: splunk_get_info, splunk_get_user_info, splunk_get_indexes, splunk_get_metadata, splunk_get_knowledge_objects, splunk_run_query, splunk_run_saved_search, saia_generate_spl, saia_explain_spl, saia_optimize_spl, saia_ask_splunk_question. Query budget: max 6 tool calls, 50 result rows, 30s timeout. This patch does not change Splunk configuration.
- `discover-saved-searches-first`: Before writing custom SPL, inspect validated saved searches from the compiled contract and prefer a matching saved search when the mission requests validated knowledge. Available saved searches: SplunkEnterpriseSecuritySuite::ES - Dashboard Lateral Movement By Source, SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain, SplunkEnterpriseSecuritySuite::ES - Prompt Injection Event Sample, search::CloudTrail - All Management Events, search::CloudTrail - IAM Access Key Anomalies, search::DNS - All Queries Last 24h, search::DNS - Suspicious Exfiltration Queries, search::ES - Lateral Movement Auth Chain, search::Network - Suspicious Egress Spike, search::Platform - MCP Gateway Latency.
- `carry-evidence-into-final-answer`: Final answers must include query or saved-search provenance, result count, mission time window, and evidence refs returned by Splunk. If evidence is missing or tool errors occur, state uncertainty instead of a definitive conclusion.

## SAIA Assistance

### SPL-001 / violation-mission-security-lateral-movement-readiness-spl-001-mission-security-lateral-movement-readiness-trace-001

Query: `search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now`

SAIA Explanation: The query searches all indexes and references src_ip, which is not canonical in this fixture.

SAIA Optimized Query: `search index=wineventlog host=win-finance-07 src=* earliest=-24h latest=now`

SAIA Rationale: Narrow to the known authentication index and canonical src field.

SAIA Warnings: Prefer a validated saved search or canonical field src.

### SPL-003 / violation-mission-security-lateral-movement-readiness-spl-003-mission-security-lateral-movement-readiness-trace-001

Query: `search index=* host=win-finance-07 src_ip=* earliest=-24h latest=now`

SAIA Explanation: The query searches all indexes and references src_ip, which is not canonical in this fixture.

SAIA Optimized Query: `search index=wineventlog host=win-finance-07 src=* earliest=-24h latest=now`

SAIA Rationale: Narrow to the known authentication index and canonical src field.

SAIA Warnings: Prefer a validated saved search or canonical field src.


## Diff

```diff
+ inject-contract-summary: Use the compiled Splunk contract contract-acme-soc-dev version 2026.06.01 in fixture mode. Allowed read-only tools: splunk_get_info, splunk_get_user_info, splunk_get_indexes, splunk_get_metadata, splunk_get_knowledge_objects, splunk_run_query, splunk_run_saved_search, saia_generate_spl, saia_explain_spl, saia_optimize_spl, saia_ask_splunk_question. Query budget: max 6 tool calls, 50 result rows, 30s timeout. This patch does not change Splunk configuration.
+ discover-saved-searches-first: Before writing custom SPL, inspect validated saved searches from the compiled contract and prefer a matching saved search when the mission requests validated knowledge. Available saved searches: SplunkEnterpriseSecuritySuite::ES - Dashboard Lateral Movement By Source, SplunkEnterpriseSecuritySuite::ES - Lateral Movement Auth Chain, SplunkEnterpriseSecuritySuite::ES - Prompt Injection Event Sample, search::CloudTrail - All Management Events, search::CloudTrail - IAM Access Key Anomalies, search::DNS - All Queries Last 24h, search::DNS - Suspicious Exfiltration Queries, search::ES - Lateral Movement Auth Chain, search::Network - Suspicious Egress Spike, search::Platform - MCP Gateway Latency.
+ carry-evidence-into-final-answer: Final answers must include query or saved-search provenance, result count, mission time window, and evidence refs returned by Splunk. If evidence is missing or tool errors occur, state uncertainty instead of a definitive conclusion.
+ saia-explain-violation-mission-security-lateral-movement-readiness-spl-001-mission-security-lateral-movement-readiness-trace-001: The query searches all indexes and references src_ip, which is not canonical in this fixture.
+ saia-optimize-violation-mission-security-lateral-movement-readiness-spl-001-mission-security-lateral-movement-readiness-trace-001: search index=wineventlog host=win-finance-07 src=* earliest=-24h latest=now
+ saia-explain-violation-mission-security-lateral-movement-readiness-spl-003-mission-security-lateral-movement-readiness-trace-001: The query searches all indexes and references src_ip, which is not canonical in this fixture.
+ saia-optimize-violation-mission-security-lateral-movement-readiness-spl-003-mission-security-lateral-movement-readiness-trace-001: search index=wineventlog host=win-finance-07 src=* earliest=-24h latest=now
```

## Review

This patch is exported for human review. It does not mutate Splunk.
