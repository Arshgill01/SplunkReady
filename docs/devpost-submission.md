# Devpost Submission Draft

## Project Name

SplunkReady

[![npm version](https://badge.fury.io/js/splunkready.svg)](https://www.npmjs.com/package/splunkready)

## Tagline

Certify AI agents before they touch production Splunk.

## Submission Track

Platform & Developer Experience

Security is the flagship use case. Splunk MCP and hosted-model integrations support the platform story, but the submission copy should not claim multiple mutually exclusive prize targets.

## Elevator Pitch

Splunk is making operational data agent-ready. SplunkReady makes agents Splunk-ready.

SplunkReady is a Splunk-native certification workbench for teams shipping AI agents that can call Splunk. The Agent Readiness Compiler compiles a fixture or live Splunk environment into a deployment-specific contract, records agent behavior as a tool trace, grades that trace with deterministic rules, and emits a Readiness Receipt before the agent is allowed near production.

## What It Does

SplunkReady answers one operational question: is this agent ready for this Splunk deployment?

The workbench can run a reproducible fixture certification, inspect proof runs, verify manifests, export redacted public proof bundles, and accept externally captured traces or MCP transcripts. The primary artifact is the Readiness Receipt: contract version, mission suite, trace provenance, deterministic violations, score, verdict, evidence refs, and policy patch summary.

The tracked evidence pack is in `submission-evidence/`:

- `suite-proof/` proves three credential-free missions across security and observability.
- `public-proof-export/` shows the redacted derivative export boundary.
- `screenshots/` shows the packaged workbench, Vite-backed workbench, and public proof export UI.
- `claim-ledger.md` maps public claims to concrete evidence paths and verification commands.

## Flagship Demo

The demo uses security investigation readiness. A naive Splunk-facing agent investigates possible lateral movement, searches too broadly, uses the wrong field, ignores validated saved-search provenance, and gives an unsupported answer. SplunkReady catches the unsafe trace with deterministic rule IDs, exports a reviewable policy patch, reruns the mission, and produces a READY receipt with evidence refs.

The local fixture path requires no live Splunk credentials:

```bash
npx -y splunkready@0.1.0 judge-proof --out ./judge-proof --json
```

That clean-folder command returns `PASS`, records `mutation: false`, and writes
the judge proof bundle without requiring a repository clone.

For the full local workbench from a clone:

```bash
npm install
npm run workbench
```

The command builds the runtime and UI, starts one localhost-only workbench origin, and prints the local URL, artifact root, fixture capability, live capability, and SAIA status.

For a strict CLI evidence gate:

```bash
npm run splunkready -- proof-audit --out submission-evidence/suite-proof --require-pass true --json
npm run splunkready -- verify-manifest --out submission-evidence/suite-proof --json
```

## Judging Criteria

### Technical Implementation

SplunkReady has a real TypeScript implementation, schema-validated artifacts, a deterministic grader, a local HTTP workbench, fixture/live adapter parity, external trace intake, MCP transcript certification, proof audits, and proof manifests. The broad repository gate is:

```bash
npm run check
```

The Move 21 evidence pack verifies in place from tracked files.

### Use Of Splunk

Splunk concepts are first-class in the contract and grader: indexes, sourcetypes, saved searches, knowledge objects, canonical fields, app context, evidence requirements, and query budgets. Live mode uses the Splunk MCP adapter boundary when operator-owned env vars are configured, while fixture mode keeps the demo reproducible for judges.

SplunkReady does not mutate Splunk. It exports policy guidance for operator review.

### Originality

This is not a chatbot, SOC copilot, telemetry dashboard, detection-health dashboard, or generic eval harness. It is a pre-production certification harness: a deployment-specific receipt proving whether an agent can safely use Splunk here.

### Practical Value

Teams adopting Splunk-connected agents need a gate between "the model can call a tool" and "the model is safe for this deployment." SplunkReady turns that gate into a reviewable receipt, a manifest-verifiable proof bundle, and a local workbench that developers and operators can inspect together.

## Splunk MCP Integration

The Splunk MCP interface is the certification boundary for live mode. Fixture and live paths converge after the adapter, so the same compiler, mission runner, trace recorder, grader, policy patch, and receipt logic run regardless of whether the source is a local fixture or a live MCP endpoint.

SplunkReady's MCP value is not that it replaces Splunk MCP. It uses Splunk MCP as the source of real agent/tool behavior, then exposes a local certification MCP server so other MCP clients can discover posture resources, reuse certification prompts, and request deterministic Readiness Receipts for captured traces and transcripts.

Live mode is optional and disabled by default. The tracked evidence pack does not include raw live artifacts or credentials. Live claims should be treated as conditional unless the operator generates and sanitizes a separate live evidence export.

## Hosted-Model Integration

SplunkReady supports hosted-model style assistance through `saia_explain_spl` and `saia_optimize_spl` when those tools are available. The assistance is advisory: it can explain unsafe SPL and suggest a corrected query shape, but deterministic rules remain the pass/fail authority.

The tracked evidence pack does not claim live hosted-model entitlement. The workbench reports SAIA status at startup, and hosted-model diagnostic workflows can prove availability when operator credentials permit it.

## What It Is Not

- Not a Splunk chatbot.
- Not a SOC copilot.
- Not MCP telemetry.
- Not a detection-health dashboard.
- Not a generic eval harness.
- Not an LLM judging another LLM.

## Built With

- TypeScript
- Zod
- Vitest
- Vite
- Published npm CLI: `npm install -g splunkready` or `npx splunkready@latest judge-proof`
- Splunk MCP adapter boundary
- Deterministic trace grader rules
- Local workbench API and UI
- Readiness Receipt, proof audit, and proof manifest artifacts

## Evidence Links

- Evidence pack: `submission-evidence/README.md`
- Claim ledger: `submission-evidence/claim-ledger.md`
- Architecture diagram: `architecture_diagram.md`
- Dev verification: `npm run check`
