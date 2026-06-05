# Decision Log

Canonical decisions live in `DECISIONS.md`.

Use this file for implementation-time decision notes before promoting them to `DECISIONS.md`.

## 2026-06-05 - Autonomous Post-Move Hardening Bar

The owner explicitly raised the bar beyond "finish the current moves list":

- Do not mark the goal complete merely because the current `moves/` files are implemented.
- After current moves are complete, keep the goal open and continue with product hardening:
  - improve efficiency;
  - clean and simplify the workbench;
  - fix bugs and weak functionality;
  - add high-leverage features when they increase major-award competitiveness without violating SplunkReady's constraints.
- Treat the target as a production-level project built to win a significant award category, not only a small feedback prize.
- Keep quality standards stricter, not looser:
  - maintainability matters;
  - modularity matters;
  - refactor bad code into better code where evidence shows it is necessary;
  - keep implementation clean and reviewable.
- Use the existing move list as a floor, not a ceiling.

Operational consequence:

- Keep adding focused moves for discovered hardening work, such as final UI consolidation.
- Keep testing/debug UI affordances while they are useful for verification, then intentionally consolidate them near the end.
- Do not call the goal complete until listed moves, added high-leverage moves, final clean-room verification, and post-move product hardening are all actually evidenced.
