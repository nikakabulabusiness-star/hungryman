// Runs the exact native renderer in Node, with TypeScript compiled in memory.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
  module._compile(result.outputText, filename);
};
const { loadChannelSnapshot, prepareChannelReport, formatMetric, reportFilename, tbilisiTimestamp, selectWindow } = require("../src/lib/channel-analytics.ts");
const { createChannelReport } = require("../src/lib/channel-report.ts");
const { PDFDocument } = require("pdf-lib");

(async () => {
  const original = await loadChannelSnapshot();
  const fixed = new Date("2026-10-22T22:50:00Z");
  let calls = 0;
  const fresh = await loadChannelSnapshot();
  fresh.youtube.followers.value = 700001;
  const captured = await prepareChannelReport(async () => { calls++; return fresh; }, () => fixed);
  assert.equal(calls, 1);
  assert.equal(captured.snapshot.youtube.followers.value, 700001, "Export must use the fresh provider value");
  fresh.youtube.followers.value = 800002;
  assert.equal(captured.snapshot.youtube.followers.value, 700001, "Later refresh must not change a PDF mid-render");
  assert.notEqual(original.youtube.followers.value, captured.snapshot.youtube.followers.value);
  await assert.rejects(prepareChannelReport(async () => { throw new Error("Offline"); }), /Offline/);
  assert.equal(formatMetric({ label: "missing", value: null }), "მიუწვდომელია");
  assert.equal(formatMetric({ label: "zero", value: 0 }), "0");
  assert.equal(formatMetric({ label: "time", value: 502, unit: "seconds" }), "8:22");
  assert.match(reportFilename(fixed), /2026-10-23T02-50/);
  assert.match(tbilisiTimestamp(fixed), /23\/10\/2026, 02:50/);
  for (const window of original.windows) {
    assert.equal(window.views.series.reduce((a, b) => a + b, 0), window.views.value);
    const days = (Date.parse(window.end) - Date.parse(window.start)) / 86400000 + 1;
    assert.equal(days, window.days);
  }
  assert.throws(() => selectWindow({ ...original, windows: [] }, 28));
  const out = process.argv[2];
  assert.ok(out, "Pass an output directory");
  fs.mkdirSync(out, { recursive: true });
  const bytes = await createChannelReport(original, fixed);
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 10);
  fs.writeFileSync(path.join(out, "Hungryman-Analytics-Demo.pdf"), bytes);
  const missing = await loadChannelSnapshot();
  missing.windows.forEach((w) => { w.unique.value = null; w.unique.unavailableReason = "ეს მაჩვენებელი API-ით მიუწვდომელია"; });
  missing.youtube.countries = [];
  const unavailableBytes = await createChannelReport(missing, fixed);
  assert.equal((await PDFDocument.load(unavailableBytes)).getPageCount(), 10);
  fs.writeFileSync(path.join(out, "missing-data-test.pdf"), unavailableBytes);
  console.log("PASS: fresh snapshots, immutable capture, failures, missing vs zero, periods, Tbilisi dates, 10-page PDF rendering");
})().catch((e) => { console.error(e); process.exitCode = 1; });
