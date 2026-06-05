# Move 75: MCP Client Certification Loop

## Trigger

The latest competitive audit correctly reframed the "Best Use of Splunk MCP"
gap: SplunkReady should not compete by merely having its own local MCP server.
It needs to show an agent-driven workflow where Splunk MCP performs the
investigation actions and SplunkReady certifies the captured behavior.

## Scope

- Add MCP resources that expose a reusable stdio client configuration and a
  Splunk MCP certification loop.
- Add a reusable MCP prompt that guides agents to use Splunk MCP for read-only
  investigation, preserve the transcript, and certify it through SplunkReady.
- Update `mcp-proof` so the one-command proof reads those resources/prompts and
  emits an `agentDrivenWorkflow` block.
- Update README/example copy to make the Splunk MCP role explicit.

## Boundaries

- Do not add write operations against Splunk.
- Do not make LLM or MCP output authoritative for pass/fail.
- Do not read, source, print, or commit `.env*` or `.splunkready*` files.
- Do not add dependencies.
- Do not change UI source; Playwright is not required.
- Do not use subagents.

## Acceptance

- `mcp-proof-summary.json` includes MCP client configuration evidence,
  certification-loop prompt/resource evidence, and an `agentDrivenWorkflow`
  block.
- The MCP server tests prove the new resources and prompt are discoverable.
- The CLI proof regression proves the one-command stdio path exercises the new
  surface.
- Full repository checks pass.
