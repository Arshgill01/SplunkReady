# ExecPlan: MCP Category Evidence Boundaries

Created: 2026-06-08

## Objective

Convert the MCP category story from a list of artifacts into an auditable
scorecard that a judge or reviewer can inspect quickly.

## Current Evidence

The project already has:

- a SplunkReady MCP server with tools, resources, resource templates, and
  prompts;
- a credential-free mock Splunk MCP session;
- a dual-server recorder session;
- AppInspect MCP composition;
- hosted-model diagnostic MCP tooling;
- a real Zed Agent run that triggered Splunk investigation MCP calls and
  produced a certified Readiness Receipt.

The weak point is claim discipline. The tracked Zed JSONL preserves the Splunk
investigation frames and final answer, but not a visible
`splunkready_recorder_flush` tool-call frame. The certification exists in the
adjacent artifacts and screenshot. The claim ledger must say that precisely.

## Success Criteria

- A scorecard artifact reports each MCP proof surface and its evidence paths.
- The scorecard distinguishes PASS evidence from limitations.
- The Zed evidence is marked as real but thin when the frame count is small.
- The audit fails on missing MCP server surface, missing composition evidence,
  missing Zed certification, redaction leaks, or mutation claims.
- The audit warns, rather than silently passes, when the Zed JSONL lacks a
  visible recorder-flush frame.
- The topology doc explains how Splunk MCP, AppInspect MCP, Zed, and
  SplunkReady MCP fit together without claiming SplunkReady replaces Splunk MCP.

## Stop Conditions

- Do not edit `README.md`, `package.json`, `package-lock.json`, `src/`, or
  other package input paths unless a new npm publish is planned.
- Do not hide Zed evidence limitations.
- Do not make LLM or hosted-model output authoritative.

## Outcome

Completed as Move 188 on 2026-06-08.

The MCP category scorecard now reports `PASS_WITH_LIMITATIONS` with score `96`.
It verifies the SplunkReady MCP surface, mock Splunk MCP composition, AppInspect
MCP composition, hosted-model MCP fixture path, operator-live hosted-model
boundary, and Zed external-client evidence. It also records two limitations:

- the Zed evidence has 5 tracked frames, so it is compact;
- the tracked Zed JSONL does not contain a visible
  `splunkready_recorder_flush` frame, even though certification is proven by
  adjacent artifacts and the Zed screenshot.
