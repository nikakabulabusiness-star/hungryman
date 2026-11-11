import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { reportAssets } from "./report-assets";
import { workBoards, workStageLabel, type WorkTechnical, type WorkVideo, type WorkVideoDetail } from "./work-model";

export type WorkExportFormat = "pdf" | "json" | "csv";
export type WorkExportPhoto = { id: string; bytes?: Uint8Array; mime?: string; unavailableReason?: string };

export const workMoney = (tetri: number) => `${(tetri / 100).toFixed(2)} GEL`;
const timestamp = (value: number | Date) => new Date(value).toLocaleString("ka-GE", { timeZone: "Asia/Tbilisi", hour12: false });
const boardLabel = (id: string) => workBoards.find(board => board.id === id)?.label || id;
const actionLabels: Record<string, string> = { create: "შექმნა", save: "რედაქტირება", move: "ეტაპის შეცვლა", approve: "დამტკიცება", return: "დაბრუნება", link: "გადაღების დაკავშირება" };

export function workExportFilename(video: Pick<WorkVideo, "id" | "version">, format: WorkExportFormat, at = new Date()) {
  const id = video.id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100) || "video";
  return `Hungryman-Work-${id}-v${video.version}-${at.toISOString().replace(/[:.]/g, "-")}.${format}`;
}

/** Export only this project. The API's unrelated people directory and viewer permissions are not an archive. */
export function workExportPayload(detail: WorkVideoDetail, exportedAt = new Date()) {
  const { permissions: _permissions, ...video } = detail.video;
  return { schemaVersion: 1, exportedAt: exportedAt.toISOString(), timeZone: "Asia/Tbilisi", moneyUnit: "tetri", video, history: detail.history, snapshots: detail.snapshots };
}

export function workPhotoIds(video: WorkVideo): string[] {
  return [...new Set([video.content.coverId, ...video.content.photoIds, ...video.callSheet.photoIds,
    ...video.callSheet.locations.flatMap(location => location.photoIds), ...video.technical.photoIds,
    ...(video.approvedTechnical?.photoIds || [])].filter((id): id is string => !!id))];
}

/** CSV text cells are neutralized before quoting, including formulas hidden behind whitespace. */
export function workBudgetCsv(detail: WorkVideoDetail): string {
  const video = detail.video;
  const rows: (string | number)[][] = [["პროექტი", video.title], ["ID", video.id], ["ვერსია", video.version], [],
    ["კატეგორია", "ტიპი", "დასახელება", "რაოდენობა", "ერთეულის ფასი (GEL)", "ჯამი (GEL)", "სტატუსი", "მომწოდებელი", "ნომერი", "აღება", "დაბრუნება"]];
  const amount = (value: number) => (value / 100).toFixed(2);
  for (const row of video.callSheet.budget) rows.push([row.category, row.type === "service" ? "სერვისი" : row.type === "product" ? "პროდუქტი" : "ნივთი", row.label, row.quantity, amount(row.unitPrice), amount(Math.round(row.quantity * row.unitPrice)), "ქოლშითი", "", "", "", ""]);
  const addEquipment = (technical: WorkTechnical, status: string) => {
    for (const row of technical.items.filter(item => item.source === "rental")) rows.push(["ტექნიკა", "ქირაობა", row.name, row.quantity, amount(row.unitPrice), amount(Math.round(row.quantity * row.unitPrice)), status, row.vendor, row.phone, row.pickupAt, row.returnAt]);
  };
  if (video.approvedTechnical) addEquipment(video.approvedTechnical, "დამტკიცებული — შედის ჯამში");
  // The pending plan replaces its approved version; it must never be added on top of the total.
  if (JSON.stringify(video.technical) !== JSON.stringify(video.approvedTechnical)) addEquipment(video.technical, "მოლოდინში — არ შედის ჯამში");
  rows.push([], ["", "", "ქოლშითი", "", "", amount(video.totals.base)],
    ["", "", "დამტკიცებული ტექნიკა", "", "", amount(video.totals.technicalApproved)],
    ["", "", "საერთო ჯამი", "", "", amount(video.totals.grandTotal)],
    ["", "", "ტექნიკა მოლოდინში (ჯამში არ შედის)", "", "", amount(video.totals.technicalPending)]);
  const cell = (value: string | number) => {
    let content = String(value);
    if (typeof value === "string" && (/^[\t\r\n]/.test(content) || /^\s*[=+\-@]/.test(content))) content = "'" + content;
    return `"${content.replace(/"/g, '""')}"`;
  };
  return "\uFEFF" + rows.map(row => row.map(cell).join(",")).join("\r\n");
}

/** Measured Unicode wrapping retains long URLs/words and explicit paragraph breaks without shrinking text. */
export function wrapWorkText(value: string, maxWidth: number, measure: (value: string) => number): string[] {
  const result: string[] = [];
  for (const paragraph of value.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n")) {
    if (!paragraph.trim()) { result.push(""); continue; }
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (measure(next) <= maxWidth) { line = next; continue; }
      if (line) { result.push(line); line = ""; }
      for (const character of Array.from(word)) {
        if (line && measure(line + character) > maxWidth) { result.push(line); line = ""; }
        line += character;
      }
    }
    if (line) result.push(line);
  }
  return result;
}

/** Searchable vector PDF, with embedded Georgian fonts and automatic pagination. No WebView or remote fonts. */
export async function createWorkReport(detail: WorkVideoDetail, generatedAt = new Date(), photos: WorkExportPhoto[] = []): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regular, bold] = await Promise.all([
    pdf.embedFont(reportAssets.regular, { subset: true }), pdf.embedFont(reportAssets.bold, { subset: true }),
  ]);
  const video = detail.video, sheet = video.callSheet;
  pdf.setTitle(`${video.title} — ქოლშითი`);
  pdf.setAuthor("Hungryman Work");
  pdf.setSubject(`Work ${video.id} / version ${video.version}`);
  pdf.setCreationDate(generatedAt);
  pdf.setModificationDate(generatedAt);
  const width = 595.28, height = 841.89, margin = 42, available = width - margin * 2;
  const ink = rgb(0.06, 0.1, 0.15), muted = rgb(0.32, 0.38, 0.44), red = rgb(0.88, 0.16, 0.25), border = rgb(0.86, 0.89, 0.92);
  let page: PDFPage, y = 0;
  function addPage() {
    page = pdf.addPage([width, height]);
    page.drawRectangle({ x: 0, y: height - 5, width, height: 5, color: red });
    page.drawText("HUNGRYMAN / WORK", { x: margin, y: height - 31, size: 9, font: bold, color: muted });
    page.drawText(`v${video.version}`, { x: width - margin - 35, y: height - 31, size: 9, font: bold, color: red });
    y = height - 61;
  }
  function room(required: number) { if (y - required < 57) addPage(); }
  function lines(value: string, size: number, font: PDFFont = regular, maxWidth = available) {
    return wrapWorkText(value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ""), maxWidth, text => font.widthOfTextAtSize(text, size));
  }
  function text(value: string, size = 10, font: PDFFont = regular, color = ink) {
    const leading = size * 1.5;
    for (const line of lines(value, size, font)) {
      room(leading);
      if (line) page.drawText(line, { x: margin, y: y - size, size, font, color });
      y -= leading;
    }
  }
  function section(title: string) {
    room(66); y -= 13;
    text(title, 15, bold, red);
    page.drawLine({ start: { x: margin, y: y - 4 }, end: { x: width - margin, y: y - 4 }, color: border, thickness: 0.8 });
    y -= 13;
  }
  function field(label: string, value: string | number | boolean | null | undefined) {
    room(33); text(label, 9, bold, muted);
    text(value === null || value === undefined || value === "" ? "—" : typeof value === "boolean" ? value ? "კი" : "არა" : String(value));
    y -= 4;
  }
  function item(title: string) { room(47); y -= 7; text(title, 11, bold); y -= 4; }
  function empty() { text("ინფორმაცია ჯერ არ არის.", 10, regular, muted); }
  const location = (id: string) => sheet.locations.find(row => row.id === id)?.name || id || "—";
  const day = (id: string) => sheet.days.find(row => row.id === id)?.date || id || "—";
  const crew = (id: string) => sheet.crew.find(row => row.id === id)?.name || id;

  addPage();
  text(video.title, 24, bold);
  text(`${video.kind === "short" ? "Shorts / სოციალური მედია" : "ვიდეო"} · ვერსია ${video.version}`, 11, regular, muted);
  y -= 9;
  field("პროექტის ID", video.id);
  field("ექსპორტი (თბილისი)", timestamp(generatedAt));
  field("შექმნილია / ბოლო ცვლილება (თბილისი)", `${timestamp(video.created)} / ${timestamp(video.updated)}`);
  section("01 / ვიდეო და სცენარი");
  field("მოკლე იდეა", video.content.summary); field("იდეა", video.content.idea);
  field("სცენარი", video.content.script); field("საჭიროებები", video.content.requirements);
  section("02 / ზოგადი ინფორმაცია");
  field("პროდიუსერი", sheet.producer); field("რეჟისორი", sheet.director); field("კლიენტი", sheet.client);
  field("ფორმატი / პლატფორმა", sheet.format); field("ხანგრძლივობა", sheet.duration);
  section("03 / დღეები და განრიგი");
  if (!sheet.days.length) empty();
  for (const [index, row] of sheet.days.entries()) {
    item(`დღე ${index + 1} · ${row.date || "თარიღი არ არის მითითებული"}`);
    field("შეკრება / კამერა / დასრულება", `${row.callTime || "—"} / ${row.cameraTime || "—"} / ${row.endTime || "—"}`);
    field("დღის მიზანი", row.goal); field("ლოკაცია", location(row.locationId)); field("შენიშვნა", row.notes);
  }
  if (sheet.scenes.length) item("სცენების განრიგი");
  for (const [index, row] of sheet.scenes.entries()) {
    item(`${index + 1}. ${row.title}`);
    field("დღე / სივრცე / განათება", `${day(row.dayId)} · ${row.interior === "INT" ? "ინტერიერი" : "ექსტერიერი"} · ${row.light === "DAY" ? "დღე" : "ღამე"}`);
    field("მოსვლა / კამერა / დასრულება", `${row.arrivalTime || "—"} / ${row.cameraTime || "—"} / ${row.endTime || "—"}`);
    field("ლოკაცია", location(row.locationId)); field("გუნდი", row.crewIds.map(crew).join(", "));
    field("აღწერა", row.description); field("რეკვიზიტი", row.props); field("ეფექტები", row.effects);
  }
  section("04 / გუნდი");
  if (!sheet.crew.length) empty();
  for (const row of sheet.crew) {
    item(`${row.name} · ${row.userId ? "თანამშრომელი" : "გარე პირი"}`);
    field("პოზიცია / დავალება", [row.role, row.task].filter(Boolean).join(" · "));
    field("ტელეფონი / ელფოსტა", [row.phone, row.email].filter(Boolean).join(" · "));
    field("მოსვლის დრო / დღეები", [row.callTime, row.dayIds.map(day).join(", ")].filter(Boolean).join(" · "));
  }
  section("05 / ლოკაციები");
  if (!sheet.locations.length) empty();
  for (const row of sheet.locations) {
    item(row.name); field("მისამართი", row.address); field("რუკა", row.mapUrl);
    field("კოორდინატები", row.latitude !== null && row.longitude !== null ? `${row.latitude}, ${row.longitude}` : "");
    field("საკონტაქტო პირი / ნომერი", [row.contactName, row.contactPhone].filter(Boolean).join(" · "));
    field("პარკინგი", row.parking); field("წვდომა", row.access); field("ფოტოების ID", row.photoIds.join(", "));
  }
  section("06 / საჭიროებები");
  if (!sheet.needs.length) empty();
  for (const row of sheet.needs) {
    item(`${row.done ? "შესრულებულია" : "გასაკეთებელია"} · ${row.category}`);
    field("აღწერა", row.description); field("პასუხისმგებელი", row.responsible);
  }
  section("07 / ბიუჯეტი");
  if (!sheet.budget.length) empty();
  for (const category of [...new Set(sheet.budget.map(row => row.category))]) {
    item(category || "სხვა ხარჯი");
    for (const row of sheet.budget.filter(row => row.category === category)) {
      field(row.label, `${row.type === "service" ? "სერვისი" : row.type === "product" ? "პროდუქტი" : "ნივთი"} · ${row.quantity} × ${workMoney(row.unitPrice)} = ${workMoney(Math.round(row.quantity * row.unitPrice))}`);
    }
    field("კატეგორიის ჯამი", workMoney(sheet.budget.filter(row => row.category === category).reduce((sum, row) => sum + Math.round(row.quantity * row.unitPrice), 0)));
  }
  field("ქოლშითის ბიუჯეტი", workMoney(video.totals.base));
  field("დამტკიცებული ტექნიკა", workMoney(video.totals.technicalApproved));
  field("საერთო ჯამი", workMoney(video.totals.grandTotal));
  field("მიმდინარე ტექნიკა — დამტკიცების მოლოდინში (ჯამში არ შედის)", workMoney(video.totals.technicalPending));
  section("08 / ტექნიკური გეგმა");
  function technical(plan: WorkTechnical) {
    if (!plan.items.length) empty();
    for (const row of plan.items) {
      item(`${row.name} · ${row.quantity} ცალი · ${row.source === "rental" ? "ქირაობა" : "საკუთარი"}`);
      if (row.source === "rental") {
        field("ერთეულის ფასი / ჯამი", `${workMoney(row.unitPrice)} / ${workMoney(Math.round(row.quantity * row.unitPrice))}`);
        field("საიდან ქირავდება / ნომერი", [row.vendor, row.phone].filter(Boolean).join(" · "));
        field("აღება / დაბრუნება", `${row.pickupAt || "—"} / ${row.returnAt || "—"}`);
      }
      field("პასუხისმგებელი / მზადყოფნა", `${row.responsible || "—"} · ${row.ready ? "მზადაა" : "მოსამზადებელია"}`);
    }
    field("ტექნიკური შენიშვნები", plan.notes); field("ფოტოების ID", plan.photoIds.join(", "));
  }
  item("მიმდინარე ტექნიკური გეგმა"); technical(video.technical);
  if (video.approvedTechnical) {
    if (JSON.stringify(video.approvedTechnical) === JSON.stringify(video.technical)) field("დამტკიცება", "ზემოთ მოცემული ტექნიკური გეგმა დამტკიცებულია.");
    else { item("ბოლო დამტკიცებული ტექნიკური გეგმა (ჯამში შედის ეს ვერსია)"); technical(video.approvedTechnical); }
  } else field("დამტკიცება", "ტექნიკური გეგმა ჯერ არ არის დამტკიცებული.");
  section("09 / შენიშვნები და უსაფრთხოება");
  field("ზოგადი შენიშვნები", sheet.notes); field("დეპარტამენტების შენიშვნები", sheet.departmentNotes);
  field("კვება", sheet.catering); field("რადიოარხები", sheet.radioChannels); field("საგანგებო კონტაქტები", sheet.emergency);
  field("ამინდი", sheet.weather); field("დღის სინათლე", sheet.daylight);
  field("პირველი სარეზერვო ასლი", sheet.backupPrimary); field("მეორე სარეზერვო ასლი", sheet.backupSecondary);
  section("10 / ფოტოები");
  const photoMap = new Map(photos.map(photo => [photo.id, photo]));
  const ids = workPhotoIds(video);
  if (!ids.length) empty();
  for (const id of ids) {
    const photo = photoMap.get(id);
    let picture;
    try {
      if (photo?.bytes) picture = photo.mime?.includes("png") ? await pdf.embedPng(photo.bytes) : await pdf.embedJpg(photo.bytes);
    } catch { /* The missing image remains explicitly identified below. */ }
    if (picture) {
      const dimensions = picture.scaleToFit(available, 280);
      room(dimensions.height + 45);
      page!.drawImage(picture, { x: margin + (available - dimensions.width) / 2, y: y - dimensions.height, ...dimensions });
      y -= dimensions.height + 7; text(id, 8, regular, muted); y -= 8;
    } else field(id, photo?.unavailableReason || "ფოტო ვერ ჩაიტვირთა. ორიგინალი იხილეთ პროექტის ფაილებში.");
  }
  section("11 / ეტაპები და დაკავშირებული გადაღებები");
  for (const board of workBoards) {
    if (video.stages[board.id]) field(board.label, workStageLabel(board.id, video.stages[board.id]));
    if (video.reviewNotes[board.id]) field(`${board.label} — შენიშვნა`, video.reviewNotes[board.id]);
  }
  for (const shoot of video.shoots) field(`${shoot.date} · ${shoot.id}`, `${day(shoot.dayId)} · ${shoot.status}`);
  section("12 / ცვლილებების ისტორია");
  if (!detail.history.length) empty();
  for (const row of detail.history) {
    item(`v${row.version} · ${boardLabel(row.board)} · ${actionLabels[row.action] || row.action}`);
    field("ავტორი / დრო (თბილისი)", `${row.actorName} · ${timestamp(row.created)}`);
    if (row.fromStage || row.toStage) field("ეტაპი", `${workStageLabel(row.board, row.fromStage) || "—"} → ${workStageLabel(row.board, row.toStage) || "—"}`);
    if (row.comment) field("კომენტარი", row.comment);
  }
  section("13 / დამტკიცებული ვერსიების არქივი");
  if (!detail.snapshots.length) empty();
  for (const row of detail.snapshots) {
    item(`${boardLabel(row.board)} · v${row.version}`);
    field("არქივის ID", row.id); field("სათაური", row.data.title);
    field("დამამტკიცებელი / დრო (თბილისი)", `${row.actorName} · ${timestamp(row.created)}`);
    field("დაფიქსირებული ბიუჯეტი", workMoney(row.data.totals.grandTotal));
    field("დაფიქსირებული დღეები", row.data.callSheet.days.map(value => value.date).join(", "));
  }
  if (detail.snapshots.length) text("წინა ვერსიების სრული მონაცემები ინახება პროექტის არქივში და JSON ექსპორტში.", 9, regular, muted);
  for (const [index, currentPage] of pdf.getPages().entries()) {
    currentPage.drawLine({ start: { x: margin, y: 40 }, end: { x: width - margin, y: 40 }, thickness: 0.6, color: border });
    currentPage.drawText("HUNGRYMAN WORK · ქოლშითი", { x: margin, y: 25, size: 8, font: regular, color: muted });
    currentPage.drawText(`${index + 1} / ${pdf.getPageCount()}`, { x: width - margin - 45, y: 25, size: 8, font: bold, color: muted });
  }
  return pdf.save();
}
