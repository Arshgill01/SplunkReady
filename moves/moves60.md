# Move 60: LLM Specimen Proof Command

## Trigger

The competitive audit and user feedback called out that the default demo hides
the real LLM trace-producer path. The fix is to make the model-backed specimen
proof first-class without making the model authoritative for pass/fail.

## Scope

- Add a one-command `llm-proof` CLI path.
- Add an npm script so the proof is discoverable.
- Document the proof in README and the LLM specimen guide.
- Cover the command with a fake Gemini endpoint regression.

## Boundaries

- Do not make LLM output the readiness judge.
- Do not change deterministic rule authority.
- Do not call live Splunk in the fixture proof.
- Do not read, source, print, or commit `.env*` or `.splunkready*` files.
- Do not change UI source; Playwright is not required.
- Do not use subagents.

## Acceptance

- `llm-proof` fails closed when no Gemini key is configured.
- With a Gemini key, `llm-proof` generates before and after model-produced
  traces, receipts, proof audit, and `llm-proof-summary.json`.
- The summary records the LLM as trace producer and deterministic rules as the
  pass/fail authority.
- Focused LLM CLI coverage and full repository checks pass.
