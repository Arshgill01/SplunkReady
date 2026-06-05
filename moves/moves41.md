# Move 41 - Agent Trace Bridge

## Goal

Reduce external-agent integration friction by giving framework callbacks and tool wrappers a small SplunkReady trace bridge instead of requiring developers to hand-write canonical trace JSON.

## Scope

- Add a dependency-free bridge over the existing `TraceRecorder`.
- Expose methods for tool calls, tool results, tool errors, final answers, and external trace upload payloads.
- Prove the bridge output passes the existing external trace parser and certification workflow.
- Document how LangChain, AutoGen, CrewAI, LlamaIndex, and custom agents can call the bridge from their own callback surfaces.
- Record the latest competitive audit risks locally.

## Non-Goals

- Do not add LangChain, AutoGen, CrewAI, or LlamaIndex dependencies.
- Do not build a new MCP server.
- Do not make LLM output authoritative for pass/fail.
- Do not change the trace schema.
- Do not change the UI in this move.
- Do not work on video or submission packaging.

## Expected Files

- `src/integrations/agent-trace-bridge.ts`
- `tests/integrations/agent-trace-bridge.test.ts`
- `examples/README.md`
- `logs/risk-register.md`
- `moves/README.md`
- `moves/moves41.md`
- `logs/execution-log.md`
- `logs/verification-log.md`

## Verification

- `npm test -- tests/integrations/agent-trace-bridge.test.ts`
- `npm run check && git diff --check`

## Acceptance Criteria

- The bridge records schema-valid trace events with stable parent links.
- `externalTracePayload()` emits a payload accepted by the workbench/API external trace parser.
- A bridge-generated pass trace certifies through the real external trace workflow and produces a `READY / 100` receipt.
- Docs show how an external agent framework can call the bridge without pretending SplunkReady owns the agent runtime.
- Risk tracking captures native integration friction, deterministic perception risk, and live security data availability risk.
