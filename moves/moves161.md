# Move 161 - AppInspect Grade Splunk App

## Intent

Advance the Move 157 static package proof into a stronger Use-of-Splunk story:
a Splunk app that is shaped for AppInspect validation and optional
operator-owned receipt storage, while preserving SplunkReady's no-auto-mutation
boundary.

## Scope

- Add Splunk app validation checks around package anatomy, config names, XML,
  static assets, and forbidden paths.
- Add AppInspect CLI/API integration when credentials/tooling are available,
  with a blocked-but-honest artifact when unavailable.
- Add optional KV-store collection config for operator-owned Readiness Receipt
  storage.
- Add a dashboard view that reads receipt status from bundled static evidence or
  an operator-owned KV-store collection.
- Track evidence under `submission-evidence/splunk-app-package/`.

## Non-Goals

- Do not auto-install the app into Splunk.
- Do not write receipts into Splunk without an operator action.
- Do not claim Splunkbase vetting unless AppInspect/vetting actually passes.

## Verification

- Package validation tests.
- AppInspect smoke or explicit blocked artifact.
- `npm run splunk-app:package`
- `npm run check`
