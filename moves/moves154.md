# Move 154 - GitHub Packages Scoped Mirror

## Intent

Publish SplunkReady to the repository's GitHub Packages surface so the GitHub
sidebar no longer shows "No packages published." Keep the existing public npmjs
package identity unchanged.

## Scope

- Add a manually dispatched GitHub Actions workflow with `packages: write`.
- Publish a temporary scoped package as `@arshgill01/splunkready`.
- Keep the root `package.json` name as `splunkready` for the public npmjs
  package.
- Verify the scoped GitHub package from inside the workflow using
  `GITHUB_TOKEN`.
- Track evidence for the GitHub Packages publish and verification runs.

## Stop Conditions

- Do not print or commit package tokens.
- Do not replace the public `splunkready` npmjs package name with a scoped
  GitHub Packages-only name.
- Do not claim the GitHub Packages mirror is the primary unauthenticated judge
  install path; npmjs remains the no-auth public path.

## Verification

- `gh workflow run github-packages.yml --ref splunkready-build`
- `gh run watch 27102265257 --exit-status`
- `gh workflow run github-packages.yml --ref splunkready-build`
- `gh run watch 27102292369 --exit-status`
- `gh run watch 27102290866 --exit-status`
- `git diff --check`

## Result

Implemented. GitHub Packages workflow run `27102265257` published
`@arshgill01/splunkready@0.1.3`, and run `27102292369` verified the package
through `npm view` with the workflow `GITHUB_TOKEN`.
