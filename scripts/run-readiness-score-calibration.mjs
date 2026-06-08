import { writeReadinessScoreCalibration } from "../dist/src/workflows/readiness-score-calibration.js";

const outIndex = process.argv.indexOf("--out");
const outDir = outIndex >= 0 ? process.argv[outIndex + 1] : "submission-evidence/readiness-score-calibration";
const json = process.argv.includes("--json");

if (!outDir) {
  throw new Error("--out requires a directory path.");
}

const { report, artifacts } = await writeReadinessScoreCalibration(outDir);

if (json) {
  console.log(JSON.stringify({ status: report.status, outDir, artifacts, summary: report.summary }, null, 2));
} else {
  console.log(`${report.status} readiness-score-calibration`);
  for (const artifact of artifacts) {
    console.log(`artifact ${artifact}`);
  }
}
