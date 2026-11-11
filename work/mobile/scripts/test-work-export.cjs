// Exercises the exact native renderer, including Unicode text, page bounds and export privacy.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => {
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
  module._compile(source.outputText, filename);
};
const { PDFDocument, PDFPage } = require("pdf-lib");
const { emptyCallSheet, emptyWorkContent, emptyTechnical, workBoards } = require("../src/lib/work-model.ts");
const { createWorkReport, workExportPayload, workBudgetCsv, workExportFilename, wrapWorkText, workPhotoIds } = require("../src/lib/work-export.ts");
const fixed = new Date("2026-10-26T08:30:00Z");
const longUrl = "https://example.test/" + "გრძელი".repeat(80);
const technical = { items: [{ id: "cam", name: "კამერა", quantity: 2, source: "rental", unitPrice: 5555, vendor: "ტექნიკის სახლი", phone: "+995555000000", pickupAt: "2026-10-27T08:00", returnAt: "2026-10-28T09:00", responsible: "ნინო", ready: true }], notes: "აკუმულატორი დამატებით", photoIds: [] };
const sheet = { ...emptyCallSheet(), producer: "პროდიუსერი", director: "რეჟისორი", client: "კლიენტი", format: "ვიდეო", duration: "30 წამი",
  days: [{ id: "d1", date: "2026-10-27", callTime: "08:00", cameraTime: "09:00", endTime: "18:00", goal: "მთავარი სცენა", locationId: "loc1", notes: "დილის მომზადება" }, { id: "d2", date: "2026-10-28", callTime: "10:00", cameraTime: "11:00", endTime: "17:00", goal: "გარე სცენა", locationId: "loc1", notes: "" }],
  crew: [{ id: "c1", userId: "u1", name: "ნინო შიდა", role: "ოპერატორი", task: "კამერის მართვა", phone: "+995555111111", email: "nino@example.test", callTime: "08:00", dayIds: ["d1", "d2"] }, { id: "c2", userId: null, name: "გიორგი გარე", role: "მსახიობი", task: "მთავარი როლი", phone: "+995555222222", email: "gio@example.test", callTime: "09:00", dayIds: ["d1"] }],
  locations: [{ id: "loc1", name: "სტუდია", address: "თბილისი", mapUrl: longUrl, latitude: 41.72, longitude: 44.78, contactName: "ანა", contactPhone: "+995555333333", parking: "ორი ადგილი", access: "მეორე კარი", photoIds: ["photo1"] }],
  scenes: [{ id: "s1", title: "გაცნობა", description: "ჩაის მომზადება", dayId: "d1", arrivalTime: "08:30", cameraTime: "09:00", endTime: "12:00", locationId: "loc1", crewIds: ["c1", "c2"], interior: "INT", light: "DAY", props: "ჩაი", effects: "ორთქლი" }],
  needs: [{ id: "n1", category: "რეკვიზიტი", description: "ჭიქა", responsible: "ანა", done: true }],
  budget: [{ id: "b1", category: "ორგანიზება", type: "service", label: '  =HYPERLINK("https://bad.test")', quantity: 1.5, unitPrice: 1001 }, { id: "b2", category: "კვება", type: "product", label: "ჩაი, ყავა\nსაჭმელი", quantity: 2, unitPrice: 500 }],
  notes: "ბოლო შენიშვნა", departmentNotes: "ხმის გადამოწმება", catering: "სადილი 14:00", radioChannels: "არხი 2", emergency: "112", weather: "მზიანი", daylight: "07:00–18:00", backupPrimary: true, backupSecondary: false, photoIds: ["photo1", "missing-photo"] };
const video = { id: "project-123", title: "ქართული ქოლშითი", kind: "video", entryBoard: "story", stages: { story: "approved", production: "scheduled", editing: null, social: null, technical: "review" }, content: { ...emptyWorkContent(), summary: "მოკლე იდეა", idea: "იდეის აღწერა", script: ("სცენარის ტექსტი და გამოსახულების აღწერა. ".repeat(600)) + "\nსცენარის ბოლო სიტყვა", requirements: "პრაქტიკული მოთხოვნა", coverId: "photo1" }, callSheet: sheet, technical, approvedTechnical: { ...technical, items: technical.items.map(row => ({ ...row, quantity: 1 })) }, totals: { currency: "GEL", base: 2502, technicalApproved: 5555, technicalPending: 11110, grandTotal: 8057, categories: [{ name: "ორგანიზება", total: 1502 }, { name: "კვება", total: 1000 }] }, version: 9, createdBy: "u1", created: +fixed, updated: +fixed, permissions: { editBoards: ["production"], approve: true, remove: true }, shoots: [{ id: "shoot1", dayId: "d1", date: "2026-10-27", status: "scheduled" }], reviewNotes: { technical: "შეამოწმე დამატებითი კამერა" } };
const detail = { video, history: [{ id: "h1", board: "production", action: "approve", fromStage: "review", toStage: "scheduled", comment: "დადასტურებულია", actorName: "დამფუძნებელი", created: +fixed, version: 8 }], snapshots: [{ id: "revision-8", board: "production", version: 8, created: +fixed, actorName: "დამფუძნებელი", data: { title: video.title, kind: video.kind, content: video.content, callSheet: sheet, technical, approvedTechnical: video.approvedTechnical, totals: video.totals } }], meta: { boards: workBoards, editBoards: ["production"], canApprove: true, canContacts: true, people: [{ userId: "private-unrelated-user", email: "private@example.test", name: "არ არის გუნდის წევრი", role: "HR", memberships: [] }], assignable: [], unlinkedShoots: [] } };

(async () => {
  const payload = workExportPayload(detail, fixed);
  const json = JSON.stringify(payload);
  assert.ok(!json.includes("private@example.test") && !json.includes('"permissions"'), "Project export must not include unrelated employee metadata or viewer permissions");
  assert.equal(payload.snapshots[0].data.callSheet.crew[1].phone, "+995555222222", "Archived call sheets must retain their full frozen contact data");
  assert.equal(payload.moneyUnit, "tetri");
  assert.deepEqual(workPhotoIds(video), ["photo1", "missing-photo"]);
  assert.match(workExportFilename({ id: "../../bad/name", version: 9 }, "pdf", fixed), /^Hungryman-Work-[A-Za-z0-9_-]+-v9-[A-Za-z0-9_-]+\.pdf$/);
  const csv = workBudgetCsv(detail);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"\'  =HYPERLINK(""https://bad.test"")"'), "Spreadsheet formulas must be neutralized even after spaces");
  assert.ok(csv.includes('"ჩაი, ყავა\nსაჭმელი"'), "Commas/newlines must remain within quoted cells");
  assert.ok(csv.includes('"15.02"') && csv.includes('"80.57"') && csv.includes('"111.10"'), "Fractional quantities must round to tetri and pending totals must stay distinct");
  assert.ok(csv.includes("მოლოდინში — არ შედის ჯამში") && csv.includes("დამტკიცებული — შედის ჯამში"));
  const wrapped = wrapWorkText(longUrl, 45, text => Array.from(text).length);
  assert.equal(wrapped.join(""), longUrl);
  assert.ok(wrapped.every(line => Array.from(line).length <= 45));
  assert.deepEqual(wrapWorkText("პირველი\n\nმეორე", 100, text => text.length), ["პირველი", "", "მეორე"]);

  let drawCount = 0;
  const actualDrawText = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function (text, options) {
    drawCount++;
    assert.ok(options.x >= 41.9, "Text must stay inside the left margin");
    assert.ok(options.x + options.font.widthOfTextAtSize(text, options.size) <= this.getWidth() - 41.5, `Text must not overflow: ${text.slice(0, 30)}`);
    assert.ok(options.y >= 24 && options.y <= this.getHeight() - 24, "Text must stay within page bounds");
    return actualDrawText.call(this, text, options);
  };
  const png = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64"));
  const bytes = await createWorkReport(detail, fixed, [{ id: "photo1", bytes: png, mime: "image/png" }, { id: "missing-photo", unavailableReason: "ფოტოს კავშირი მიუწვდომელია" }]);
  PDFPage.prototype.drawText = actualDrawText;
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 12 && drawCount > 300, "Long script and all production sections should paginate");
  const directory = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), "hungryman-work-export-test-"));
  fs.mkdirSync(directory, { recursive: true });
  const filename = path.join(directory, "work-export-test.pdf");
  fs.writeFileSync(filename, bytes);
  const extracted = execFileSync("pdftotext", [filename, "-"], { encoding: "utf8" });
  for (const expected of ["სცენარის ბოლო სიტყვა", "გიორგი გარე", "კამერის მართვა", "კატეგორიის ჯამი", "80.57 GEL", "111.10 GEL", "ტექნიკის სახლი", "ფოტოს კავშირი მიუწვდომელია", "revision-8", "რადიოარხები", "სარეზერვო ასლი", "07:00–18:00"]) assert.ok(extracted.includes(expected), `Searchable Georgian PDF must retain: ${expected}`);
  const blank = { ...detail, video: { ...video, title: "ცარიელი პროექტი", content: emptyWorkContent(), callSheet: emptyCallSheet(), technical: emptyTechnical(), approvedTechnical: null }, history: [], snapshots: [] };
  const emptyBytes = await createWorkReport(blank, fixed);
  assert.ok((await PDFDocument.load(emptyBytes)).getPageCount() > 0);

  // Native filesystem/share calls are simulated; the actual serialization and PDF renderer still run.
  const Module = require("node:module"), originalLoad = Module._load, originalFetch = global.fetch;
  const files = [], shares = [], requests = [];
  let available = true;
  class MockFile {
    constructor(_directory, name) { this.name = name; this.uri = "file:///cache/" + name; this.modificationTime = Date.now(); this.deleted = false; files.push(this); }
    create() { this.created = true; }
    async write(data) { this.data = data; }
    delete() { this.deleted = true; }
  }
  const expired = new MockFile(null, "Hungryman-Work-old.pdf"); expired.modificationTime = Date.now() - 48 * 3600000;
  const unrelated = new MockFile(null, "avatar.jpg"); unrelated.modificationTime = expired.modificationTime;
  const current = new MockFile(null, "Hungryman-Work-current.pdf");
  Module._load = function (request, parent, isMain) {
    if (request === "expo-file-system") return { File: MockFile, Paths: { cache: { list: () => [expired, unrelated, current] } } };
    if (request === "expo-sharing") return { isAvailableAsync: async () => available, shareAsync: async (uri, options) => shares.push({ uri, options }) };
    if (request === "./api" && parent.filename.endsWith("export-work.ts")) return { workPhotoSource: id => ({ uri: "https://work.example.test/api/work/files?id=" + id, headers: { Authorization: "Bearer test-only-token" } }) };
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const { shareWorkDetail } = require("../src/lib/export-work.ts");
    available = false;
    await assert.rejects(shareWorkDetail(blank, "json"), /მიუწვდომელია/);
    assert.equal(shares.length, 0);
    available = true;
    const sharing = shareWorkDetail(blank, "json");
    const savedTitle = blank.video.title; blank.video.title = "later-refresh";
    await sharing;
    assert.equal(JSON.parse(files.at(-1).data).video.title, savedTitle, "Share must capture its revision before awaiting native APIs");
    assert.ok(expired.deleted && !unrelated.deleted && !current.deleted && !files.at(-1).deleted, "Only old Work exports should be deleted; chooser must retain the new URI");
    assert.equal(shares.at(-1).options.mimeType, "application/json");
    await shareWorkDetail(detail, "csv");
    assert.ok(files.at(-1).data.startsWith("\uFEFF"));
    assert.equal(shares.at(-1).options.mimeType, "text/csv");
    global.fetch = async (uri, options) => {
      requests.push({ uri, options });
      if (uri.endsWith("missing-photo")) return { ok: false };
      return { ok: true, headers: new Headers({ "content-type": "image/png", "content-length": String(png.length) }), arrayBuffer: async () => png.buffer };
    };
    await shareWorkDetail(detail, "pdf");
    assert.equal(requests.length, 2);
    assert.ok(requests.every(row => row.options.headers.Authorization === "Bearer test-only-token" && row.options.signal), "Photo requests must retain auth and cancellable timeouts");
    assert.equal(shares.at(-1).options.mimeType, "application/pdf");
    assert.ok((await PDFDocument.load(files.at(-1).data)).getPageCount() >= 12);
  } finally { Module._load = originalLoad; global.fetch = originalFetch; }
  console.log(`PASS: Work PDF (${doc.getPageCount()} pages), Georgian extraction, measured bounds, photos, empty state, archive privacy, currency, formula-safe CSV, immutable native sharing and cache lifecycle. Artifact: ${filename}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
