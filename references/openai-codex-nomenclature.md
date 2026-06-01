# OpenAI Codex Nomenclature Check

Checked: 2026-06-01

Official sources:

- OpenAI Skills docs: https://developers.openai.com/api/docs/guides/tools-skills
- OpenAI Codex `AGENTS.md` docs: https://developers.openai.com/codex/guides/agents-md
- Codex use cases page: https://developers.openai.com/codex/use-cases

## Findings

- The official term is **Agent Skills**.
- A skill is a versioned bundle of files plus a `SKILL.md` manifest.
- The `SKILL.md` manifest uses front matter and instructions.
- Exactly one `skill.md`/`SKILL.md` file is allowed in a skill bundle.
- Skills can be attached to hosted or local shell environments.
- When skills are available, the platform exposes each skill's `name`, `description`, and `path`.
- The model decides whether to invoke a skill from that metadata, unless explicitly instructed.
- Skill instructions are user-prompt input, not system-prompt input.
- `AGENTS.md` is separate Codex project guidance. Codex reads `AGENTS.md` / `AGENTS.override.md` from global and project scopes.
- Codex discovers `AGENTS.md` once per run/session and merges files from root down toward the working directory.

## Scaffold Consequence

SplunkReady uses:

- `AGENTS.md` for repository operating rules;
- `docs/skills/` for future Agent Skill designs only;
- no real Agent Skill bundle until repeated workflow pain justifies one.

