# Reviewer Inbox

This directory is reviewer-loop history, not judge onboarding. Latest audit:
`npm run audit:reviewers` reports 85 groups, 5 pass-with-concerns files, and 0
failing latest verdicts. For final review, start with `README.md` and
`submission-evidence/JUDGE-PATH.md`.

The continuous reviewer writes unique review files here.

Use filenames like:

```text
wave-XX-YYYYMMDD-HHMM-review.md
wave-XX-YYYYMMDD-HHMM-rereview.md
unknown-wave-YYYYMMDD-HHMM-review.md
```

The reviewer should not commit these files. The main executor reads them, resolves or waives findings, and includes the relevant inbox files in the completed wave commit.
