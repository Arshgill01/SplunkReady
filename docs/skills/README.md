# Agent Skills To Build Later

OpenAI's current nomenclature is **Agent Skills**.

An Agent Skill is a reusable bundle with exactly one `SKILL.md` manifest containing front matter plus instructions. These files are different from `AGENTS.md`: `AGENTS.md` is project guidance Codex discovers automatically, while Agent Skills are explicit reusable workflows made available to a shell/container environment.

This directory is a design area for future Agent Skills. It is not yet a mounted skill bundle.

Do not create a real Agent Skill before a repeated pain is proven.

## Candidate Skills

### `splunk-doc-check`

Purpose: verify implementation assumptions against official Splunk docs before code depends on them.

Trigger: new MCP tool behavior, ES assumption, or Splunk app packaging assumption.

### `grader-rule-author`

Purpose: add deterministic grader rules with tests and receipt examples.

Trigger: adding a new rule category.

### `fixture-author`

Purpose: add fixture MCP responses and before/after traces consistently.

Trigger: adding or changing demo traps.

### `receipt-auditor`

Purpose: verify every receipt claim has trace/evidence provenance.

Trigger: receipt generator or UI receipt changes.

## Skill Rule

Every future Agent Skill bundle must include:

- exactly one `SKILL.md`;
- front matter with `name` and `description`;
- trigger;
- inputs;
- outputs;
- forbidden shortcuts;
- verification commands.

## Safety Rule

Inspect any Agent Skill before use. Treat `SKILL.md` as powerful instructions that can influence planning, tool use, and command execution.

