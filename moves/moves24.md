# Move 24 - Run The Final Clean-Room Submission Gate

## Goal

Prove the final submission works for a judge from a clean clone with no local
ignored artifacts or credentials.

## Scope

Expected files:

- final checklist or completion record
- logs
- only blocker fixes discovered by the clean-room run

## Plan

1. Clone the public repository into a fresh directory.
2. Run README setup exactly as written.
3. Start the workbench and execute the fixture certification workflow.
4. Run documented external trace and MCP transcript flows.
5. Verify public evidence pack links and hashes.
6. Open README, Devpost draft, root architecture diagram, and video link.
7. Run the canonical offline gate twice.
8. Run secret scans and inspect tracked screenshots.
9. Record exact command results, source commit, public URLs, and residual risks.

## Acceptance Criteria

- Clean clone passes the documented judge path.
- Workbench fixture certification works from UI.
- Evidence, README, Devpost, and video agree.
- No P0 move is incomplete.
- Residual risks are explicit and do not contradict public claims.

## Verification

```bash
npm ci
npm run check
npm run check
npm run build
npm run ui:build
npm run workbench
npm run audit:reviewers
npm run audit:submission-copy
git diff --check
git status --short
```

## Stop Conditions

- Stop submission for failed clean-room setup, inaccessible public links,
  missing root architecture file, secret exposure, or stale claims.
- Do not waive a P0 failure without explicit owner approval.
