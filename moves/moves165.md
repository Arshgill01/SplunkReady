# Move 165 - Operator Live Splunk App Install Proof

## Intent

Turn the current AppInspect-clean `.spl` package from package-shaped evidence
into observed live Splunk evidence. The proof should install or upgrade the
SplunkReady app on the operator-owned local Splunk server, then verify that the
launcher view, overview view, KV Store collection, and lookup are present.

## Scope

- Add an explicit operator live install/probe workflow for
  `submission-evidence/splunk-app-package/SplunkReady-0.1.3.spl`.
- Require a confirm flag for any install, upgrade, restart, or receipt-store
  write action.
- Read live connection details only from environment variables owned by the
  operator shell. Do not print or persist secret values.
- Support a no-env/no-confirm path that writes a public-safe `SKIP` artifact
  explaining the missing operator setup.
- Probe the installed app through Splunk management APIs or Splunk CLI:
  app metadata, view presence, nav presence, KV Store collection presence, and
  lookup presence.
- Write public-safe evidence under `submission-evidence/splunk-app-install/`
  with redacted endpoints, no usernames/passwords/tokens, and no deployment
  inventory beyond the minimal app-install checks.
- Keep AppInspect as advisory validation and SplunkReady receipts as the
  deterministic authority.

## Non-Goals

- Do not make live Splunk installation part of `judge-proof`, `mcp-proof`,
  `npm run check`, or any default no-credential path.
- Do not install into a production Splunk deployment.
- Do not claim Splunkbase approval or Splunk Cloud vetting.
- Do not write receipt rows to KV Store in this move; that is Move 166.

## Verification

- No-env focused test proves the workflow returns `SKIP` without leaking values.
- Confirmed local operator run installs or upgrades the package and writes a
  public-safe proof artifact.
- App/view/KV/lookup probes report `PASS`.
- `npm run splunk-app:package`
- AppInspect smoke against the same `.spl`.
- `npm run check`

