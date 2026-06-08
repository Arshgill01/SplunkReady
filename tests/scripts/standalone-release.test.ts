import { describe, expect, it } from "vitest";

// @ts-expect-error The release builder is an executable JavaScript module.
import { currentTarget, executableNameForTarget, postjectInvocation, releaseAssetNames } from "../../scripts/build-standalone-release.mjs";

describe("standalone release builder", () => {
  it("normalizes release asset names by target", () => {
    expect(releaseAssetNames("linux-x64")).toEqual({
      archiveName: "splunkready-linux-x64.tar.gz",
      checksumName: "splunkready-linux-x64.tar.gz.sha256",
      manifestName: "standalone-release-linux-x64.json",
      executableName: "splunkready"
    });

    expect(releaseAssetNames("windows-x64")).toEqual({
      archiveName: "splunkready-windows-x64.tar.gz",
      checksumName: "splunkready-windows-x64.tar.gz.sha256",
      manifestName: "standalone-release-windows-x64.json",
      executableName: "splunkready.exe"
    });
  });

  it("reports the current runner target in release naming format", () => {
    expect(currentTarget()).toMatch(/^(macos|linux|windows)-(x64|arm64)$/);
    expect(executableNameForTarget(currentTarget())).toMatch(/^splunkready(\\.exe)?$/);
  });

  it("uses the postject JavaScript CLI directly on Windows runners", () => {
    const invocation = postjectInvocation("win32");
    expect(invocation.command).toBe(process.execPath);
    expect(invocation.leadingArgs[0]).toMatch(/node_modules[\\/]postject[\\/]dist[\\/]cli\.js$/);
  });
});
