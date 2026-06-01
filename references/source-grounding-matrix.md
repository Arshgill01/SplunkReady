# Source Grounding Matrix

This matrix maps product claims to source evidence.

## Prior Local Research

| Claim | Local Source |
|---|---|
| Product name and thesis locked as SplunkReady | `../Splunk/research/PREBUILD.md`, `../Splunk/research/final-decision.md` |
| MCP tools include query, metadata, knowledge objects, saved search, and `saia_*` tools | `../Splunk/research/sources.md` |
| Fixture/live boundary is required | `../Splunk/research/PREBUILD.md` |
| Deterministic grader is non-negotiable | `../Splunk/research/PREBUILD.md`, `../Splunk/research/final-decision.md` |
| Detection health alone is weak due to Detection Studio and ES testing | `../Splunk/research/sources.md`, `../Splunk/research/opportunity-map.md` |
| MCP telemetry and rate limiting already exist | `../Splunk/research/sources.md` |
| Security is story, Platform & Developer Experience is track | `../Splunk/research/final-decision.md`, `../Splunk/research/locked-plan.md` |

## Official Splunk Sources

| Claim | Official Source |
|---|---|
| Hackathon deliverables, tracks, prizes | https://splunk.devpost.com/ and https://splunk.devpost.com/rules |
| MCP Server tool surface | https://help.splunk.com/en/splunk-enterprise/mcp-server-for-splunk-platform/1.2/mcp-server-tools |
| MCP Telemetry Dashboard exists | https://help.splunk.com/en/splunk-cloud-platform/mcp-server-for-splunk-platform/1.2/mcp-telemetry-dashboard |
| MCP rate limiting exists | https://help.splunk.com/en/splunk-cloud-platform/mcp-server-for-splunk-platform/1.2/mcp-server-rate-limiting |
| Splunk knowledge-object/search-time layer matters | https://help.splunk.com/en/splunk-enterprise/manage-knowledge-objects/knowledge-management-manual/9.2/get-started-with-knowledge-objects/the-sequence-of-search-time-operations |
| CIM normalization matters | https://help.splunk.com/en/splunk-cloud-platform/common-information-model/6.1/introduction/overview-of-the-splunk-common-information-model |
| ES AI triage exists | https://help.splunk.com/en/splunk-enterprise-security-8/administer/8.5/ai-assistant-in-security-and-agentic-capabilities/ai-analysis-in-splunk-enterprise-security |

## Official OpenAI/Codex Sources

| Claim | Official Source |
|---|---|
| Correct term is Agent Skills | https://developers.openai.com/api/docs/guides/tools-skills |
| `AGENTS.md` is Codex project guidance | https://developers.openai.com/codex/guides/agents-md |
| Skills and `AGENTS.md` are separate concepts | `references/openai-codex-nomenclature.md` |

## How To Use This Matrix

Before adding a product claim to README, submission docs, or UI copy:

1. find the claim here;
2. cite the local source or official source in implementation docs;
3. if missing, add it here with evidence;
4. do not make unsupported claims in public-facing docs.

