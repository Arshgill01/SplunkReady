# Remote Cleanroom After Hosted Copy Report

Move: 105 - Remote Cleanroom After Hosted Copy

## Summary

Verdict: PASS.

This run verified the pushed `splunkready-build` branch after the npm package,
hosted demo, hosted judge-proof evidence, and public-copy guard work.

Remote branch verified:

- Remote: `git@github.com:Arshgill01/SplunkReady.git`
- Branch: `splunkready-build`
- Expected commit: `2835916b11ba7c99df062f7a7e2d553985d5c9e2`
- Cleanroom actual commit: `2835916b11ba7c99df062f7a7e2d553985d5c9e2`
- Cleanroom path: `/tmp/splunkready-move105-cleanroom-tXnn8A/repo`
- Cleanroom log: `/tmp/splunkready-move105-cleanroom-tXnn8A/cleanroom.log`
- Corrected published-package/hosted-tail log:
  `/tmp/splunkready-move105-cleanroom-tXnn8A/cleanroom-corrected-tail.log`

## Command

The cleanroom cloned the remote branch, installed dependencies, ran public-copy
and canonical gates, verified the tracked evidence checksum, smoke-tested the
published npm package from a clean temp folder, fetched both hosted routes, and
checked that sidecar artifact directories are not tracked.

Important commands:

```bash
git clone --depth 1 --branch splunkready-build --single-branch "$remote" "$tmp/repo"
npm ci --ignore-scripts
npm run audit:submission-copy
npm run check
shasum -a 256 -c submission-evidence/evidence-pack-sha256.txt
npx -y splunkready@0.1.0 judge-proof --out ./judge-proof --json
curl -fsSL "https://arshgill01.github.io/SplunkReady/?artifacts=artifacts%2Fmcp-proof#mcp-proof"
curl -fsSL "https://arshgill01.github.io/SplunkReady/?artifacts=artifacts%2Fjudge-proof#proof-browser"
```

## Results

- `npm ci --ignore-scripts`: PASS, 52 packages installed, 0 vulnerabilities.
- `npm run audit:submission-copy`: PASS, 39 required claims.
- `npm run check`: PASS.
  - scaffold verified;
  - runtime contracts verified;
  - TypeScript build completed;
  - production UI build completed;
  - public demo export audit passed with 183 files;
  - package readiness audit checked 162 packed files;
  - package installability audit installed `splunkready-0.1.0.tgz` and `npx
    splunkready judge-proof` returned `PASS`;
  - 58 test files passed;
  - 354 tests passed;
  - secret env ignore audit passed;
  - reviewer inbox audit passed with 85 groups, 5 pass-with-concerns files,
    and 0 failing latest verdicts;
  - submission copy audit passed with 39 required claims.
- `shasum -a 256 -c submission-evidence/evidence-pack-sha256.txt`: PASS for
  every tracked evidence-pack file.
- Published package smoke from a clean temp folder:
  - command: `npx -y splunkready@0.1.0 judge-proof --out ./judge-proof --json`;
  - status: `PASS`;
  - mutation: `false`;
  - LLM evidence: `NOT_REQUESTED`;
  - authority: `deterministic-rule-engine`.
- Hosted MCP proof fetch: PASS.
- Hosted judge-proof fetch: PASS.
- Tracked sidecar artifact scan: `sidecar_artifacts=absent`.

## Correction

The first cleanroom attempt ran the published-package `npx` smoke from inside
the cloned repository, which is itself named `splunkready`. That printed:

```text
sh: splunkready: command not found
```

The README and Devpost judge command say to run the published package from a
clean folder. The corrected smoke used a fresh temp directory outside the clone
and passed. This was a cleanroom procedure issue, not a product failure.

## Boundary Notes

- No live Splunk credentials were used.
- No Gemini key was used.
- `SPLUNKREADY_LLM_ENABLED=false` was set for the cleanroom gate.
- No `.splunkready*` or `.env*` secret files were read, sourced, printed, or
  committed.
- SplunkReady did not mutate Splunk.
