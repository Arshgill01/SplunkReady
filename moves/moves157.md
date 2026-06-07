# Move 157 - Splunk App Package Proof

## Intent

Close the remaining "SplunkReady lives next to Splunk, not inside Splunk" story
gap with a deterministic, credential-free Splunk app package artifact. This is a
first slice only: it packages the public artifact workbench into a Splunk app
shell that can be inspected or installed by an operator, without adding Python
handlers, scripted inputs, credentials, or Splunk write operations.

## Scope

- Generate a `SplunkReady-<version>.spl` package under
  `submission-evidence/splunk-app-package/`.
- Include a Splunk app directory with `default/app.conf`, `metadata/default.meta`,
  a Simple XML launcher view, and static public-demo assets under
  `appserver/static/splunkready/`.
- Track a package manifest with package hash, file list, official Splunk
  packaging references, `mutation: false`, and no-credential/no-handler flags.
- Add a script-level regression test that lists and extracts the tarball.
- Reject symbolic links and secret/env-style filenames from the package input.

## Non-Goals

- Do not install the app into a live Splunk deployment in this move.
- Do not add Python REST handlers, modular inputs, scripted inputs, saved
  searches, or Splunk write operations.
- Do not package raw live artifacts, env files, endpoints, or tokens.
- Do not claim Splunk Cloud vetting or Splunkbase readiness.

## Verification

- `npx vitest run tests/scripts/splunk-app-package.test.ts`
- `npm run splunk-app:package`
- `tar -tzf submission-evidence/splunk-app-package/SplunkReady-0.1.3.spl`
- `npm run audit:submission-copy`
- `npm run check`
