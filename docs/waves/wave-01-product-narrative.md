# Wave 01 - Product Narrative

## Goal

Lock the product story in implementation-facing docs.

## Scope

- One-sentence pitch.
- Demo villain and recovery arc.
- Prize strategy.
- Anti-generic positioning.

## Files Owned

- `README.md`
- `docs/product-brief.md`
- `docs/demo-story.md`

## Acceptance Criteria

- Product is described as certification, not a chatbot.
- Security is the flagship story.
- Platform & Developer Experience remains the track.
- The phrase "Splunk is making operational data agent-ready. SplunkReady makes agents Splunk-ready." appears in the brief.

## Verification

- `rg -n "certif|agent-ready|Splunk-ready|Platform" README.md docs`

## Reviewer Checklist

- Would a judge understand it in 20 seconds?
- Does it avoid claiming to invent MCP telemetry?

## Stop Conditions

- Narrative drifts toward SOC copilot.

