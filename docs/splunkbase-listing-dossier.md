# Splunkbase Listing Dossier

Status: `READY_FOR_OPERATOR_SUBMISSION`

This dossier is the copy-and-evidence packet for submitting SplunkReady to
Splunkbase. It does not claim Splunkbase approval. The public badge can be
claimed only after the package is submitted through an operator-owned publisher
account and Splunkbase returns a public listing.

## Package

- App name: `SplunkReady`
- App ID: `SplunkReady`
- Version: `0.1.7`
- Package:
  `submission-evidence/splunk-app-package/SplunkReady-0.1.7.spl`
- SHA-256:
  `282aa79b1bfa003ca7373b3588aeedb964f31c7d2636d7550af40e70d1fd70be`
- Tested Splunk version: `Splunk Enterprise 10.4.0`
- Splunk Cloud status: external review required

## Validation Evidence

- AppInspect precertification:
  `submission-evidence/splunkbase-readiness/appinspect-precert.json`
- Errors: `0`
- Failures: `0`
- Future failures: `0`
- Warnings: `1`
- Expected warning: `check_collections_conf`
- Live install proof:
  `submission-evidence/splunk-app-install/splunk-app-install-proof.json`
- Receipt KV Store proof:
  `submission-evidence/splunk-receipt-store/splunk-receipt-store-proof.json`

## Listing Assets

| Asset | Packaged path | Dimensions |
| --- | --- | --- |
| App icon | `SplunkReady/static/appIcon.png` | `36x36` |
| App icon 2x | `SplunkReady/static/appIcon_2x.png` | `72x72` |
| Screenshot | `SplunkReady/static/screenshot.png` | `623x350` |

These dimensions match the Splunkbase file-standards evidence captured in
`submission-evidence/splunkbase-readiness/splunkbase-readiness.json`.

## Portal Copy

### Tagline

Certify AI agents before they touch production Splunk.

### Short Description

SplunkReady is a Splunk-native certification harness that grades AI-agent
Splunk tool traces with deterministic rules and emits a Readiness Receipt before
the agent reaches production.

### Long Description

SplunkReady answers one operational question: is this AI agent ready for this
Splunk deployment?

The Agent Readiness Compiler turns fixture or live Splunk environment facts into
a deployment-specific contract, records agent behavior as MCP/tool traces,
grades those traces with deterministic rules, and emits a Readiness Receipt with
verdict, score, evidence refs, policy patch summary, and mutation status.

The Splunk app package embeds the credential-free artifact workbench inside
Splunk Web, includes public-safe proof bundles and screenshots, and defines an
optional operator-owned KV Store receipt collection. It ships no Splunk
credentials, Python REST handlers, scripted inputs, modular inputs, saved
searches, or default-path write operations.

### Release Notes

- Current-source Splunk app package for SplunkReady v0.1.7.
- Embeds the credential-free public artifact workbench in Splunk Web.
- Includes deterministic Readiness Receipt evidence, MCP proof artifacts,
  public-safe screenshots, and optional KV Store receipt schema.
- AppInspect precertification has zero errors, zero failures, zero future
  failures, and one expected KV Store collection warning.
- No credentials, Python REST handlers, scripted inputs, modular inputs, saved
  searches, or default-path Splunk write operations are packaged.

### Upgrade Instructions

Fresh install for v0.1.7. If upgrading from a manually installed earlier
package, install this package over the previous SplunkReady app and
restart/reload Splunk Web if required by the deployment.

### External Data Sources

The packaged Splunk app is static and credential-free. Optional live proofs and
hosted-model diagnostics are operator-run outside the package and require
explicit credentials; they are not invoked by the installed app by default.

### Support

Use the public issue tracker as the support URL:

```text
https://github.com/Arshgill01/SplunkReady/issues
```

Before submission, add a monitored support email or ticket URL controlled by the
publisher account.

## Operator Checklist

- Accept the Splunk Developer Agreement in the Splunkbase publisher portal.
- Create the SplunkReady app listing with the app information above.
- Upload `submission-evidence/splunk-app-package/SplunkReady-0.1.7.spl`.
- Confirm Splunkbase package validation, security check, and AppInspect
  validation.
- Enter monitored support contact details controlled by the publisher account.
- Choose release as soon as approved unless a deliberate release date is needed.
- Do not add an "Available on Splunkbase" badge until the public listing is
  visible.

## Official References

- [Submit Splunkbase apps](https://dev.splunk.com/enterprise/docs/releaseapps/splunkbase/submit-splunkbase-apps)
- [Reference for Splunkbase file standards](https://dev.splunk.com/enterprise/docs/releaseapps/splunkbase/approvalcriteria)
- [Upload and validate app package](https://dev.splunk.com/enterprise/docs/releaseapps/splunkbase/submit-splunkbase-apps/upload-validate-app-package)
- [Publish app](https://dev.splunk.com/enterprise/docs/releaseapps/splunkbase/submit-splunkbase-apps/publish-app)
