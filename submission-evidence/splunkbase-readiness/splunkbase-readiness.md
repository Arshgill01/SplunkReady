# Splunkbase Readiness

Source: `splunkready-splunkbase-readiness`

Status: `ACTION_REQUIRED`

Generated: `2026-06-07T21:58:07.337Z`

## Package

- App ID: `SplunkReady`
- Version: `0.1.3`
- Package: `submission-evidence/splunk-app-package/SplunkReady-0.1.3.spl`
- SHA256: `fbb367cdd2166416d290da83e7ba069508bcbf5d675374f1bc9c8a8b9b4d3fbf`
- Files: `316`

## AppInspect

- Errors: `0`
- Failures: `0`
- Future failures: `0`
- Warnings: `1`
- Successes: `102`

| Check | Result | Message |
| --- | --- | --- |
| check_collections_conf | warning | App contains collections.conf. No action required. File: default/collections.conf |

## Checklist

| Requirement | Status | Evidence | Detail |
| --- | --- | --- | --- |
| package-archive | PASS | submission-evidence/splunk-app-package/SplunkReady-0.1.3.spl | sha256=fbb367cdd2166416d290da83e7ba069508bcbf5d675374f1bc9c8a8b9b4d3fbf |
| package-single-app-root | PASS | submission-evidence/splunk-app-package/SplunkReady-0.1.3.spl | 316 packaged files |
| app-conf-identity | PASS | SplunkReady/default/app.conf | version=0.1.3 |
| cloud-metadata-role | PASS | SplunkReady/metadata/default.meta |  |
| appinspect-precert | PASS | submission-evidence/splunkbase-readiness/appinspect-precert.json | success=102; warnings=1 |
| expected-kv-warning | PASS | submission-evidence/splunkbase-readiness/appinspect-precert.json | check_collections_conf |
| credential-free-package | PASS | submission-evidence/splunk-app-package/splunk-app-package-manifest.json |  |
| live-install-proof | PASS | submission-evidence/splunk-app-install/splunk-app-install-proof.json | 6 probes; 0 failed |
| receipt-kv-proof | PASS | submission-evidence/splunk-receipt-store/splunk-receipt-store-proof.json | 6 rows verified |
| license | PASS | LICENSE |  |
| support-metadata | PASS | package.json | https://github.com/Arshgill01/SplunkReady/issues |
| splunkbase-doc-copy | PASS | README.md |  |
| listing-screenshots | PASS | submission-evidence/screenshots | 7 PNG screenshots |
| app-icon | BLOCKED_REPO | submission-evidence/splunk-app-package/SplunkReady-0.1.3.spl | No appIcon/logo asset found in package |
| publisher-account | BLOCKED_EXTERNAL | Splunkbase publisher portal | Requires operator account access; no credentials are stored in this repository. |
| splunkbase-upload | BLOCKED_EXTERNAL | Splunkbase publisher portal | Do not claim Available on Splunkbase until Splunkbase returns a public listing. |
| splunk-cloud-review | BLOCKED_EXTERNAL | Splunkbase/Splunk Cloud review | External review status is not available from local evidence. |

## Live Evidence

- Install proof: `submission-evidence/splunk-app-install/splunk-app-install-proof.json` (`PASS`, `operator-approved-app-install`)
- Receipt store proof: `submission-evidence/splunk-receipt-store/splunk-receipt-store-proof.json` (`PASS`, `operator-approved-receipt-store-write`)
- Receipt rows verified through Splunk lookup: `6`

## Official References

- [Submit Splunkbase apps](https://dev.splunk.com/enterprise/docs/releaseapps/splunkbase/submit-splunkbase-apps)
- [Package apps](https://dev.splunk.com/enterprise/docs/releaseapps/packageapps)
- [Splunk AppInspect CLI reference](https://dev.splunk.com/enterprise/reference/appinspect/appinspectcliref)
- [app.conf configuration reference](https://help.splunk.com/en/data-management/splunk-enterprise-admin-manual/10.0/configuration-file-reference/10.0.0-configuration-file-reference/app.conf)

## Next Actions

- Add a packaged app icon/logo asset before Splunkbase upload.
- Prepare Splunkbase listing metadata, support contact, release notes, and public-safe screenshots in the publisher portal.
- Upload submission-evidence/splunk-app-package/SplunkReady-0.1.3.spl through an operator-owned Splunkbase publisher account.
- Claim the Splunkbase badge only after the public Splunkbase listing is visible.
