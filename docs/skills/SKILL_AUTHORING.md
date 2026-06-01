# Agent Skill Authoring Notes

Source of truth checked: OpenAI Skills docs and Codex `AGENTS.md` docs.

## Correct Terms

- Use **Agent Skill** for a reusable skill bundle.
- Use `SKILL.md` for the skill manifest file.
- Use `AGENTS.md` for repository/project instructions.
- Do not call a wave file, checklist, or normal Markdown doc a skill unless it is packaged as an Agent Skill bundle.

## Minimal `SKILL.md`

```md
---
name: splunkready-fixture-author
description: Create or update SplunkReady fixture MCP responses and trace examples.
---

Use this skill when adding or changing fixture data for SplunkReady.
```

## Bundle Rule

A skill bundle should be a directory with exactly one `SKILL.md`. Additional files may support the skill, but the manifest is the entrypoint.

## Priority Note

Skill instructions are user-prompt-level input, not system-level instructions. `AGENTS.md` remains the project-level Codex guidance for this repository.

## SplunkReady Policy

Do not create Agent Skills during early implementation unless one of these repeats at least twice:

- adding a deterministic grader rule;
- adding fixture MCP responses;
- auditing receipt provenance;
- checking official Splunk docs for a behavior assumption.

