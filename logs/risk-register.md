# Risk Register

## Active Risks

### R001 LLM-Judging-LLM Drift

Risk: grader becomes vague AI scoring.

Mitigation: deterministic checks decide pass/fail; LLMs explain and patch.

### R002 Fake Specimen Agent

Risk: demo agent is scripted to fail/pass.

Mitigation: build a real naive agent and preserve trace.

### R003 Fixture/Live Divergence

Risk: fixture demo does not represent live MCP path.

Mitigation: shared adapter interface and shared schemas.

### R004 Generic Dashboard Drift

Risk: UI becomes cards and scores without provenance.

Mitigation: receipt and trace evidence are primary.

### R005 Splunk Feature Collision

Risk: product looks like MCP telemetry, ES triage, or detection testing.

Mitigation: keep pre-production agent certification as boundary.

