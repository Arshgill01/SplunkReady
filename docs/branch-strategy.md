# Branch Strategy

## Current Source Of Truth

`splunkready-build` is the long-running implementation branch and the current remote source of truth for SplunkReady.

Evidence from June 1, 2026:

```bash
git status --short --branch
```

Result:

```text
## splunkready-build...origin/splunkready-build
```

```bash
git branch -r -vv
```

Result:

```text
origin/HEAD              -> origin/splunkready-build
origin/splunkready-build 6feed4b wave-53: resolve handoff rereview
```

```bash
git remote -v
```

Result:

```text
origin git@github.com:Arshgill01/SplunkReady.git (fetch)
origin git@github.com:Arshgill01/SplunkReady.git (push)
```

## Working Rule

- Continue implementation waves on `splunkready-build`.
- Push each completed wave to `origin/splunkready-build`.
- Do not start from `master` unless a future human explicitly changes the branch model.
- Do not rename, merge, or force-push branches as part of normal wave work.

## Why Not `master`

The current remote branch listing only exposes `origin/splunkready-build`, and `origin/HEAD` points to it. The implementation history, reviewer logs, cleanroom verification, and continuation-wave checkpoints all live on `splunkready-build`.

If the repository later needs a default branch rename or a protected release branch, that should be handled as an explicit repository-maintenance task after the user approves the branch policy.

## Goal Status

This branch strategy does not mark the overall SplunkReady goal complete. The goal remains open until the user explicitly approves completion.
