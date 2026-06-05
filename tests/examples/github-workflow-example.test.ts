import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("GitHub workflow example", () => {
  it("uploads the composite action proof bundle and diagnostics path", async () => {
    const workflow = await readFile(new URL("../../examples/github-workflow-example.yml", import.meta.url), "utf8");
    const examplesGuide = await readFile(new URL("../../examples/README.md", import.meta.url), "utf8");
    const readme = await readFile(new URL("../../README.md", import.meta.url), "utf8");

    expect(workflow).toContain("uses: Arshgill01/SplunkReady@splunkready-build");
    expect(workflow).toContain("path: ${{ steps.splunkready.outputs.out-dir }}");
    expect(workflow).toContain("name: splunkready-action-diagnostics");
    expect(workflow).toContain("path: ${{ steps.splunkready.outputs.diagnostics-path }}");
    expect(workflow).toContain("if-no-files-found: warn");
    expect(examplesGuide).toContain("path: ${{ steps.splunkready.outputs.diagnostics-path }}");
    expect(examplesGuide).toContain("compiler-diagnostics.json");
    expect(examplesGuide).toContain("readiness-profile.json");
    expect(readme).toContain("path: ${{ steps.splunkready.outputs.diagnostics-path }}");
  });
});
