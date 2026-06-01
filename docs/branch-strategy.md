# Branch Strategy

## Current Source Of Truth

`splunkready-build` is the long-running implementation branch, the current remote source of truth, and the GitHub default branch for SplunkReady.

Current evidence from June 1, 2026:

```bash
git status --short --branch
```

Result:

```text
## splunkready-build...origin/splunkready-build
```

```bash
git remote show origin
```

Relevant result:

```text
HEAD branch: splunkready-build
Remote branch:
  splunkready-build tracked
Local ref configured for 'git push':
  splunkready-build pushes to splunkready-build (up to date)
```

```bash
git ls-remote --symref origin HEAD && git ls-remote --heads origin
```

Result:

```text
ref: refs/heads/splunkready-build	HEAD
ede4232223e07d1abca582e9649c42ac1c688099	HEAD
ede4232223e07d1abca582e9649c42ac1c688099	refs/heads/splunkready-build
```

```bash
gh repo view Arshgill01/SplunkReady --json defaultBranchRef,nameWithOwner,pushedAt
```

Result:

```json
{"defaultBranchRef":{"name":"splunkready-build"},"nameWithOwner":"Arshgill01/SplunkReady","pushedAt":"2026-06-01T12:47:54Z"}
```

## Working Rule

- Continue implementation waves on `splunkready-build`.
- Push each completed wave to `origin/splunkready-build`.
- Do not start from `master` unless a future human explicitly changes the branch model.
- Do not rename, merge, or force-push branches as part of normal wave work.

## Why Not `master`

The current remote branch listing only exposes `origin/splunkready-build`, and `origin/HEAD` points to it. The implementation history, reviewer logs, cleanroom verification, and continuation-wave checkpoints all live on `splunkready-build`.

If the repository later needs a `master` mirror, protected release branch, or another default branch, that should be handled as an explicit repository-maintenance task after the user approves the branch policy.

## Goal Status

This branch strategy does not mark the overall SplunkReady goal complete. The goal remains open until the user explicitly approves completion.
