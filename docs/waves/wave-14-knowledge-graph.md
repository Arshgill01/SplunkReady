# Wave 14 - Knowledge Graph

## Goal

Build a dependency graph across knowledge objects.

## Scope

- Panel -> saved search.
- Saved search -> macro.
- Search -> lookup.
- Search -> fields/sourcetypes.
- App context edges.

## Files Owned

- graph builder files.
- graph tests.

## Acceptance Criteria

- Graph can explain why a panel or mission depends on a saved search/macro/field.
- Edges have provenance.
- Missing dependencies become warnings, not silent drops.

## Verification

- graph fixture tests.
- snapshot or structured expected graph.

## Reviewer Checklist

- Are graph edges deterministic?
- Does graph avoid LLM parsing?

## Stop Conditions

- Graph is decorative only and unused by grader.

