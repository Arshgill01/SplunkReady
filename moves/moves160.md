# Move 160 - Standalone Release Artifacts

## Intent

Reduce judge and developer friction beyond npm by producing release assets that
can run `splunkready judge-proof` without a repo clone or project-local install.
This must be real dependency reduction, not just an `esbuild` bundle that still
requires a compatible Node runtime.

## Scope

- Prototype a Node single executable application or equivalent standalone
  release wrapper for the CLI.
- Build release assets through a GitHub Actions matrix where each OS builds its
  own executable.
- Generate `.sha256` files for every release asset.
- Add a release workflow that runs on semver tags.
- Track a local smoke artifact proving the release command can run from a clean
  temp folder.

## Non-Goals

- Do not add Homebrew until the GitHub release assets are real and verified.
- Do not replace npm as the canonical install path until package currentness and
  release currentness are both machine-checked.
- Do not claim Windows/macOS/Linux assets until each OS job has passed.

## Verification

- Release build script focused tests.
- Local current-OS smoke for the generated artifact.
- GitHub release workflow dry-run where practical.
- `npm run check`
