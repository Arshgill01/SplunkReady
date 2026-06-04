# Move 20 - Package The Workbench Run Command

## Goal

Make the interactive app easy to launch with one documented local command.

## Scope

Expected files:

- `package.json`
- workbench server entrypoint
- Vite/server integration
- README command snippet if needed
- tests
- logs

## Plan

1. Add `npm run workbench` for the local packaged workbench.
2. Add `npm run workbench:dev` for development with hot reload if useful.
3. Ensure the server serves the built UI and API from one local origin.
4. Print local URL, artifact root, and capability status on startup.
5. Default to localhost only.
6. Add graceful shutdown and port-conflict error messages.

## Acceptance Criteria

- One command starts the real interactive app.
- The first screen is the usable workbench, not a marketing page.
- Fixture certification can be run from that screen.
- Live mode capabilities are visible but disabled when env is absent.

## Verification

```bash
npm run workbench
npm run workbench:dev
npm run check
npm run ui:build
git diff --check
```

Use browser automation to open the printed URL and run the fixture workflow.

## Stop Conditions

- Stop before binding outside localhost by default.
- Stop before requiring live credentials for the fixture demo.
- Stop before making the static build pretend the API exists.
