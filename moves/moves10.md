# Move 10 - Reconcile Submission Truth And Official Requirements

## Goal

Make the repository and Devpost copy concise, current, rules-compliant, and
grounded in the public evidence pack.

## Official Constraints To Lock

- Track: Platform & Developer Experience.
- Security: flagship use case, not an eligible second track prize.
- Bonus strategy: emphasize Splunk MCP Server; claim Hosted Models only if Move
  07 passes; do not assume multiple bonus prizes can be won.
- Public video: under three minutes, publicly visible on YouTube/Vimeo/Youku,
  visibly demonstrates AI usage.
- Public open-source repository with visible license, setup, dependencies, and
  examples.
- Root file named `architecture_diagram.md`, `.pdf`, or `.png`.
- Explain significant work completed during the submission period.

## Scope

Expected files:

- `README.md`
- `docs/devpost-submission.md`
- `architecture_diagram.md` or an allowed root equivalent
- claim/source grounding documentation
- stale current-state and handoff docs where they contradict final truth
- `MANIFEST.md` only if repository state materially changes
- current wave and logs

## Plan

1. Create the required root architecture diagram from the accepted architecture.
   It must show Splunk interaction, agent/model integration, and component data
   flow.
2. Rewrite README opening for a five-minute judge review:
   - literal product name and "CI for Splunk agents" category;
   - one-command fixture demo;
   - fail-to-pass receipt output;
   - live MCP and security evidence;
   - external-agent CLI integration;
   - architecture and public evidence links.
3. Reconcile stale claims:
   - live security proof is green locally when supported by current evidence;
   - SAIA live invocation is blocked or proven according to Move 07;
   - use the actual rule implementation count;
   - call the integration a CLI gate, not an SDK;
   - distinguish deterministic fixture specimen from Gemini-backed specimen.
4. Rewrite Devpost copy around the four judging criteria and official selected
   track. Keep Security as the memorable scenario, not an ineligible award ask.
5. Describe Splunk MCP use concretely and prioritize it as the strongest bonus
   story.
6. Keep Splunk Developer Tools claims conservative unless the project can show
   actual use of Splunk's developer ecosystem rather than its own tooling.
7. Link every important claim to Move 06 evidence or mark it conditional.
8. Add a short "built during the submission period" narrative.
9. Run and improve the submission-copy audit so stale conditional claims cannot
   pass merely because expected phrases exist.

## Acceptance Criteria

- Required root architecture file exists and is legible.
- README quickstart works from a clean checkout.
- Devpost copy contains no stale live-security or SAIA claim.
- No unsupported performance, probability, coverage, or "every claim" absolute.
- Selected track and bonus positioning follow official eligibility.
- All evidence links are public and tracked.

## Verification

```bash
npm run audit:submission-copy
npm run audit:reviewers
npm run check
git diff --check
```

Manually render and inspect the root architecture diagram and every public link.

## Stop Conditions

- Stop before turning future work into present-tense evidence.
- Stop before targeting Security or Observability as track prizes.
- Stop before claiming live SAIA success without Move 07 evidence.
