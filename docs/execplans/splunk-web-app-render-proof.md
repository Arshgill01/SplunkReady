# Splunk Web App Render Proof ExecPlan

## Goal

Prove that the installed SplunkReady `.spl` package renders inside real Splunk
Web with public-safe evidence. Move 204 already proved package install,
AppInspect, and Splunk REST probes. This move adds the missing browser evidence:
Splunk Web -> SplunkReady launcher route -> static artifact workbench served by
the installed app.

## Current Reality

- `submission-evidence/splunk-app-install/splunk-app-install-proof.json`
  reports a successful operator-approved app install and successful REST probes
  for the launcher and overview views.
- The first browser attempt showed the earlier iframe launcher was not a
  reliable runtime contract: Splunk Web stripped the iframe under default
  embeddable-content protections.
- The package now uses a Splunk-native launcher panel with a first-party link
  to `/static/app/SplunkReady/splunkready/index.html`.
- The evidence pack now includes a screenshot and DOM proof from the installed
  Splunk Web app route.

## Design

Add `scripts/capture-splunk-app-web-proof.mjs`.

The script:

1. Parses `.splunkready-live.env` without printing secret values.
2. Requires both `SPLUNKREADY_ALLOW_SPLUNK_WEB_PROOF=1` and
   `--confirm-browser true`.
3. Derives Splunk Web URL from an explicit web URL env var when available, or
   from `SPLUNKREADY_SPLUNK_MCP_URL` by switching to the standard Splunk Web
   port.
4. Uses Playwright supplied by `npx --package playwright`, not a repo
   dependency.
5. Logs into Splunk Web using operator credentials.
6. Opens `/en-US/app/SplunkReady/splunkready` and verifies the Splunk-native
   launcher panel and static workbench link.
7. Opens `/en-US/static/app/SplunkReady/splunkready/index.html?...` and captures
   `submission-evidence/screenshots/splunk-app-web-proof.png` only after the
   static workbench renders public-safe signals.
8. Opens `/en-US/app/SplunkReady/splunkready_overview` as a secondary route
   probe.
9. Writes only public-safe route paths, booleans, status codes, artifact paths,
   and redaction facts.

## Stop Conditions

- Stop before adding Playwright to `package.json`.
- Stop before committing any endpoint, credential, token, cookie, or raw
  deployment value.
- Stop before weakening Splunk Web embeddable-content protections or adding a
  `web.conf` override to make iframe embedding work.
- Stop if Splunk Web authentication fails in a way that would require exposing
  or changing credentials in tracked files.

## Verification

- Unit-test env parsing, route derivation, and redaction helpers.
- Run the explicit live browser proof command with the operator env file.
- Re-run submission-copy audit after adding the evidence claim.
- Regenerate and verify the evidence-pack SHA-256 manifest.
- Run `npm run check`.
