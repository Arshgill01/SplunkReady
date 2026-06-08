import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

// @ts-expect-error The audit script is an executable JavaScript module.
import { auditSplunkbaseReadiness } from "../../scripts/audit-splunkbase-readiness.mjs";

const execFileAsync = promisify(execFile);

const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-splunkbase-readiness-test-"));

const writeFixture = async (path: string, value: string | Buffer): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value);
};

const pngFixture = (width: number, height: number): Buffer => {
  const buffer = Buffer.alloc(24);
  Buffer.from("89504e470d0a1a0a", "hex").copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
};

const appinspectFixture = {
  summary: {
    error: 0,
    failure: 0,
    future_failure: 0,
    skipped: 1,
    not_applicable: 145,
    warning: 1,
    success: 102
  },
  reports: [
    {
      groups: [
        {
          name: "check_configuration_files",
          checks: [
            {
              name: "check_collections_conf",
              result: "warning",
              messages: [{ message: "App contains collections.conf. No action required." }]
            }
          ]
        }
      ]
    }
  ]
};

const createSplunkAppPackage = async (root: string): Promise<void> => {
  const appRoot = join(root, "tmp-package", "SplunkReady");
  await writeFixture(
    join(appRoot, "default", "app.conf"),
    `[id]
name = SplunkReady
version = 0.1.3

[ui]
label = SplunkReady

[package]
id = SplunkReady
`
  );
  await writeFixture(join(appRoot, "metadata", "default.meta"), "[]\naccess = read : [ * ], write : [ admin, sc_admin ]\n");
  await writeFixture(join(appRoot, "default", "collections.conf"), "[splunkready_receipts]\n");
  await writeFixture(join(appRoot, "static", "appIcon.png"), pngFixture(36, 36));
  await writeFixture(join(appRoot, "static", "appIcon_2x.png"), pngFixture(72, 72));
  await writeFixture(join(appRoot, "static", "screenshot.png"), pngFixture(623, 350));
  await execFileAsync("tar", ["-czf", join(root, "submission-evidence", "splunk-app-package", "SplunkReady-0.1.3.spl"), "-C", join(root, "tmp-package"), "SplunkReady"]);
};

const createFixtureTree = async (): Promise<string> => {
  const root = await tempRoot();

  await mkdir(join(root, "submission-evidence", "splunk-app-package"), { recursive: true });
  await createSplunkAppPackage(root);

  await writeFixture(
    join(root, "submission-evidence", "splunk-app-package", "splunk-app-package-manifest.json"),
    JSON.stringify(
      {
        source: "splunkready-splunk-app-package",
        status: "PASS",
        appId: "SplunkReady",
        version: "0.1.3",
        packagePath: "submission-evidence/splunk-app-package/SplunkReady-0.1.3.spl",
        packageSha256: await execFileAsync("shasum", ["-a", "256", join(root, "submission-evidence", "splunk-app-package", "SplunkReady-0.1.3.spl")]).then(
          ({ stdout }) => stdout.split(/\s+/)[0]
        ),
        splunkbaseListingAssets: {
          appIcon: "SplunkReady/static/appIcon.png",
          appIcon2x: "SplunkReady/static/appIcon_2x.png",
          screenshot: "SplunkReady/static/screenshot.png"
        },
        noCredentialFiles: true,
        noPythonHandlers: true,
        noScriptedInputs: true
      },
      null,
      2
    )
  );
  await writeFixture(
    join(root, "submission-evidence", "splunkbase-readiness", "appinspect-precert.json"),
    JSON.stringify(appinspectFixture, null, 2)
  );
  await writeFixture(
    join(root, "submission-evidence", "splunk-app-install", "splunk-app-install-proof.json"),
    JSON.stringify(
      {
        status: "PASS",
        splunkMutation: "operator-approved-app-install",
        install: { status: "PASS" },
        probes: [{ id: "app-metadata", status: "PASS" }]
      },
      null,
      2
    )
  );
  await writeFixture(
    join(root, "submission-evidence", "splunk-receipt-store", "splunk-receipt-store-proof.json"),
    JSON.stringify(
      {
        status: "PASS",
        splunkMutation: "operator-approved-receipt-store-write",
        write: { status: "PASS" },
        lookup: { status: "PASS", rowCount: 6 }
      },
      null,
      2
    )
  );
  await writeFixture(join(root, "README.md"), "submission-evidence/splunk-app-package/SplunkReady-0.1.3.spl\nsubmission-evidence/splunk-app-install/splunk-app-install-proof.json\n");
  await writeFixture(join(root, "LICENSE"), "MIT\n");
  await writeFixture(
    join(root, "package.json"),
    JSON.stringify({ repository: { url: "https://github.com/Arshgill01/SplunkReady" }, bugs: { url: "https://github.com/Arshgill01/SplunkReady/issues" } })
  );

  for (const name of ["one.png", "two.png", "three.png", "four.png"]) {
    await writeFixture(join(root, "submission-evidence", "screenshots", name), pngFixture(1280, 720));
  }

  return root;
};

describe("Splunkbase readiness audit", () => {
  it("reports AppInspect/live proof readiness and external listing blockers", async () => {
    const root = await createFixtureTree();
    const report = await auditSplunkbaseReadiness({
      root,
      generatedAt: "2026-06-08T00:00:00.000Z"
    });

    expect(report.status).toBe("ACTION_REQUIRED");
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "appinspect-precert", status: "PASS" }),
        expect.objectContaining({ id: "live-install-proof", status: "PASS" }),
        expect.objectContaining({ id: "receipt-kv-proof", status: "PASS" }),
        expect.objectContaining({ id: "app-icon", status: "PASS" }),
        expect.objectContaining({ id: "splunkbase-screenshot", status: "PASS" }),
        expect.objectContaining({ id: "splunkbase-upload", status: "BLOCKED_EXTERNAL" })
      ])
    );
    expect(report.package.listingAssets).toMatchObject({
      appIcon: { dimensions: { width: 36, height: 36 } },
      appIcon2x: { dimensions: { width: 72, height: 72 } },
      screenshot: { dimensions: { width: 623, height: 350 } }
    });
    expect(report.appinspect.warnings).toEqual([expect.objectContaining({ name: "check_collections_conf" })]);

    await expect(readFile(join(root, "submission-evidence", "splunkbase-readiness", "splunkbase-readiness.json"), "utf8")).resolves.toContain(
      "splunkready-splunkbase-readiness"
    );
    await expect(readFile(join(root, "submission-evidence", "splunkbase-readiness", "splunkbase-readiness.md"), "utf8")).resolves.toContain(
      "Do not claim Available on Splunkbase"
    );
  });
});
