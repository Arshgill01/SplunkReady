# Wave 06 - MCP Adapter Contract

## Goal

Define the adapter interface shared by fixture and live modes.

## Scope

- Method names.
- Inputs/outputs.
- Error shapes.
- Trace hooks.

## Files Owned

- adapter interface files.
- adapter type tests.

## Acceptance Criteria

- Downstream compiler does not know fixture vs live.
- All tool outputs are normalized.
- Errors preserve tool name and request context.

## Verification

- adapter typecheck.
- adapter unit tests.

## Reviewer Checklist

- Does interface cover `splunk_get_knowledge_objects`, metadata, query, saved search, and user info?
- Are AI Assistant methods optional but typed?

## Stop Conditions

- Live-specific behavior leaks into compiler.

