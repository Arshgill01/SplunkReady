# Move 63: External MCP Certification Workflow Extraction

## Trigger

The competitive audit identified two linked caps: `src/cli.ts` remains too
large, and the Best Use of Splunk MCP Server story needs the captured Splunk MCP
agent path to be first-class rather than CLI-internal plumbing.

## Scope

- Move external trace grading and MCP transcript certification orchestration
  into `src/workflows/external-certification.ts`.
- Keep `grade-trace`, `import-mcp-transcript`, and `certify-mcp-transcript`
  command names, flags, artifact names, JSON shapes, and strict gates unchanged.
- Remove workflow dynamic imports back into `src/cli.ts` for external trace and
  MCP transcript certification.
- Point the local SplunkReady MCP server's external trace certification tool at
  the workflow module instead of the CLI.
- Keep deterministic grading authoritative; MCP transcripts are graded
  artifacts, not LLM-scored submissions.

## Boundaries

- Do not rename commands or flags.
- Do not make LLM grading authoritative.
- Do not change fixture/live interfaces.
- Do not read, source, print, or commit `.env*` or `.splunkready*` files.
- Do not change UI source; Playwright is not required.
- Do not use subagents.

## Acceptance

- `src/cli.ts` shrinks again after extracting the external/MCP certification
  implementation.
- Focused CLI, workbench, and integration coverage for external traces and MCP
  transcripts passes.
- TypeScript validation and the canonical repository gate pass.
