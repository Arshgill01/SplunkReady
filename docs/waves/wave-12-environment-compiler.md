# Wave 12 - Environment Compiler

## Goal

Compile raw adapter output into an Environment Contract.

## Scope

- Inventory indexes.
- Inventory metadata.
- Inventory knowledge objects.
- Inventory MCP/user capability context.

## Files Owned

- compiler files.
- compiler tests.

## Acceptance Criteria

- Compiler emits schema-valid contract.
- Contract includes version and mode.
- Missing optional tools degrade gracefully.

## Verification

- compiler fixture tests.
- schema validation.

## Reviewer Checklist

- Does compiler preserve provenance?
- Are assumptions explicit?

## Stop Conditions

- Compiler invents fields not present in source data.

