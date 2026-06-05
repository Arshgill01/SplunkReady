# Move 58: MCP Resources And Prompts

## Trigger

The competitive audit and user feedback called out that a thin MCP server is not
enough for Best Use of MCP. The stronger story is SplunkReady using Splunk MCP
as the certification boundary while exposing a local MCP certification surface
that other MCP clients can discover and reuse.

## Scope

- Add MCP resources that expose certification posture and example proof inputs.
- Add reusable MCP prompts for transcript certification, trace capture, and
  receipt explanation.
- Extend `mcp-proof` to exercise tools, resources, and prompts, not only tool
  calls.
- Update docs so the MCP story emphasizes Splunk MCP usage plus SplunkReady's
  certification server, not a Splunk search copilot.

## Boundaries

- Do not add Splunk write tools.
- Do not make LLM or prompt output authoritative for readiness.
- Do not read, source, print, or commit `.env*` or `.splunkready*` files.
- Do not change UI source; Playwright is not required.
- Do not use subagents.

## Acceptance

- MCP `initialize` advertises tools, resources, and prompts.
- MCP clients can list and read certification resources.
- MCP clients can list and fetch reusable certification prompts.
- `npm run mcp-proof` records tools, resources, prompts, posture resource, and
  transcript prompt evidence before certifying the transcript.
- Focused MCP tests and full repository checks pass.
