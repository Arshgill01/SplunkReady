# Splunkbase Readiness

Source: `splunkready-splunkbase-readiness`

Status: `ACTION_REQUIRED`

Generated: `2026-06-08T13:32:05.502Z`

## Package

- App ID: `SplunkReady`
- Version: `0.1.3`
- Package: `submission-evidence/splunk-app-package/SplunkReady-0.1.3.spl`
- SHA256: `f32e564b8ea5a741b3c3e178d9203b12389b47bb94a098062003ffd81ddfe4d8`
- Files: `320`

## Splunkbase Listing Assets

| Asset | Path | Actual | Expected |
| --- | --- | --- | --- |
| appIcon | `SplunkReady/static/appIcon.png` | 36x36 | 36x36 |
| appIcon2x | `SplunkReady/static/appIcon_2x.png` | 72x72 | 72x72 |
| screenshot | `SplunkReady/static/screenshot.png` | 623x350 | 623x350 |

## AppInspect

- Errors: `0`
- Failures: `0`
- Future failures: `0`
- Warnings: `1`
- Successes: `103`

| Check | Result | Message |
| --- | --- | --- |
| check_collections_conf | warning | App contains collections.conf. No action required. File: default/collections.conf |

## Checklist

| Requirement | Status | Evidence | Detail |
| --- | --- | --- | --- |
| package-archive | PASS | submission-evidence/splunk-app-package/SplunkReady-0.1.3.spl | sha256=f32e564b8ea5a741b3c3e178d9203b12389b47bb94a098062003ffd81ddfe4d8 |
| package-single-app-root | PASS | submission-evidence/splunk-app-package/SplunkReady-0.1.3.spl | 320 packaged files |
| app-conf-identity | PASS | SplunkReady/default/app.conf | version=0.1.3 |
| cloud-metadata-role | PASS | SplunkReady/metadata/default.meta |  |
| appinspect-precert | PASS | submission-evidence/splunkbase-readiness/appinspect-precert.json | success=103; warnings=1 |
| expected-kv-warning | PASS | submission-evidence/splunkbase-readiness/appinspect-precert.json | check_collections_conf |
| credential-free-package | PASS | submission-evidence/splunk-app-package/splunk-app-package-manifest.json |  |
| live-install-proof | PASS | submission-evidence/splunk-app-install/splunk-app-install-proof.json | 6 probes; 0 failed |
| receipt-kv-proof | PASS | submission-evidence/splunk-receipt-store/splunk-receipt-store-proof.json | 6 rows verified |
| license | PASS | LICENSE |  |
| support-metadata | PASS | package.json | https://github.com/Arshgill01/SplunkReady/issues |
| splunkbase-doc-copy | PASS | README.md |  |
| listing-screenshots | PASS | submission-evidence/screenshots | 11 PNG screenshots |
| app-icon | PASS | submission-evidence/splunk-app-package/SplunkReady-0.1.3.spl | SplunkReady/static/appIcon.png=36x36; SplunkReady/static/appIcon_2x.png=72x72 |
| splunkbase-screenshot | PASS | submission-evidence/splunk-app-package/SplunkReady-0.1.3.spl | SplunkReady/static/screenshot.png=623x350 |
| publisher-account | BLOCKED_EXTERNAL | Splunkbase publisher portal | Requires operator account access; no credentials are stored in this repository. |
| splunkbase-upload | BLOCKED_EXTERNAL | Splunkbase publisher portal | Do not claim Available on Splunkbase until Splunkbase returns a public listing. |
| splunk-cloud-review | BLOCKED_EXTERNAL | Splunkbase/Splunk Cloud review | External review status is not available from local evidence. |

## Live Evidence

- Install proof: `submission-evidence/splunk-app-install/splunk-app-install-proof.json` (`PASS`, `operator-approved-app-install`)
- Receipt store proof: `submission-evidence/splunk-receipt-store/splunk-receipt-store-proof.json` (`PASS`, `operator-approved-receipt-store-write`)
- Receipt rows verified through Splunk lookup: `6`

## Official References

- [Submit Splunkbase apps](https://dev.splunk.com/enterprise/docs/releaseapps/splunkbase/submit-splunkbase-apps)
- [Splunkbase file standards](https://dev.splunk.com/enterprise/docs/releaseapps/splunkbase/approvalcriteria)
- [Create a Splunk app and set properties](https://dev.splunk.com/enterprise/docs/developapps/createapps)
- [Package apps](https://dev.splunk.com/enterprise/docs/releaseapps/packageapps)
- [Splunk AppInspect CLI reference](https://dev.splunk.com/enterprise/reference/appinspect/appinspectcliref)
- [app.conf configuration reference](https://help.splunk.com/en/data-management/splunk-enterprise-admin-manual/10.0/configuration-file-reference/10.0.0-configuration-file-reference/app.conf)

## Next Actions

- Prepare Splunkbase listing metadata, support contact, release notes, and public-safe screenshots in the publisher portal.
- Upload submission-evidence/splunk-app-package/SplunkReady-0.1.3.spl through an operator-owned Splunkbase publisher account.
- Claim the Splunkbase badge only after the public Splunkbase listing is visible.
