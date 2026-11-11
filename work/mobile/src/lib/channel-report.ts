import { PDFDocument, rgb, type PDFPage, type PDFFont, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { reportAssets } from "./report-assets";
import { formatMetric, selectWindow, tbilisiTimestamp, type Breakdown, type ChannelSnapshot, type Metric, type PlatformReport, type WindowDays } from "./channel-analytics";

const ink = rgb(0.035, 0.085, 0.12), muted = rgb(0.37, 0.43, 0.48);
const red = rgb(1, 0.09, 0.28), pale = rgb(0.95, 0.96, 0.97), line = rgb(0.87, 0.9, 0.92);
const W = 960, H = 540;
const dateRange = (start: string, end: string) => `${start} / ${end}`;

/** Native and test builds use the same vector PDF renderer, without a WebView,
 * remote fonts, screenshots or rasterized text. */
export async function createChannelReport(snapshot: ChannelSnapshot, generatedAt: Date): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regular, bold, logo] = await Promise.all([
    pdf.embedFont(reportAssets.regular, { subset: true }),
    pdf.embedFont(reportAssets.bold, { subset: true }),
    pdf.embedPng(reportAssets.logo),
  ]);
  pdf.setTitle(`${snapshot.channel} - არხის ანალიტიკა${snapshot.mode === "demo" ? " (საცდელი)" : ""}`);
  pdf.setAuthor("Hungryman Work");
  pdf.setSubject(`Snapshot ${snapshot.id}; data through ${snapshot.dataThrough}`);
  pdf.setCreationDate(generatedAt);
  pdf.setModificationDate(generatedAt);
  let page: PDFPage;
  let pageNumber = 0;
  function text(value: string, x: number, top: number, size = 13, font: PDFFont = regular, color: RGB = ink, maxWidth = W - x - 40) {
    // Measure all labels and values; shrink rather than clip long Georgian text.
    const safe = value.replace(/[\r\n\t]+/g, " ");
    const width = font.widthOfTextAtSize(safe, size);
    const fitted = width > maxWidth ? size * maxWidth / width : size;
    page.drawText(safe, { x, y: H - top - fitted, size: fitted, font, color });
  }
  function box(x: number, top: number, width: number, height: number, color = pale) {
    page.drawRectangle({ x, y: H - top - height, width, height, color });
  }
  function addPage(title: string, sub: string, platform?: PlatformReport) {
    page = pdf.addPage([W, H]);
    pageNumber++;
    box(0, 0, W, 5, red);
    text("HUNGRYMAN / ANALYTICS", 40, 22, 11, bold, muted);
    const state = platform?.state || snapshot.mode;
    text(state === "demo" ? "საცდელი მონაცემები" : state === "unavailable" ? "მონაცემები მიუწვდომელია" : "არხის ანალიტიკა", 685, 22, 11, bold, state === "live" ? muted : red, 235);
    text(title, 40, 58, 28, bold);
    text(sub, 40, 102, 11, regular, muted);
    page.drawLine({ start: { x: 40, y: 48 }, end: { x: 920, y: 48 }, thickness: 1, color: line });
    const through = platform?.dataThrough || snapshot.dataThrough;
    text(`შექმნილია: ${tbilisiTimestamp(generatedAt)} (თბილისი)`, 40, 505, 9, regular, muted);
    text(`${state === "demo" ? "საცდელი პერიოდი" : "მონაცემები თარიღამდე"}: ${through}`, 410, 505, 9, regular, muted, 400);
    text(`${String(pageNumber).padStart(2, "0")} / 10`, 860, 505, 10, bold, muted);
  }
  function sparkline(series: number[] | undefined, x: number, top: number, width: number, height: number) {
    const points = (series || []).filter(Number.isFinite);
    if (points.length < 2) return;
    const max = Math.max(...points, 1);
    const bottom = H - top - height;
    for (let grid = 0; grid < 3; grid++) page.drawLine({ start: { x, y: bottom + grid * height / 2 }, end: { x: x + width, y: bottom + grid * height / 2 }, thickness: 0.5, color: line });
    for (let i = 1; i < points.length; i++) {
      page.drawLine({ start: { x: x + (i - 1) * width / (points.length - 1), y: bottom + points[i - 1] / max * height }, end: { x: x + i * width / (points.length - 1), y: bottom + points[i] / max * height }, thickness: 2, color: red });
    }
  }
  function metricCard(m: Metric, x: number, top: number, width: number, height = 132, caption?: string) {
    box(x, top, width, height);
    text(m.label, x + 18, top + 16, 12, regular, muted, width - 36);
    text(formatMetric(m), x + 18, top + 43, 32, bold, m.value === null ? muted : ink, width - 36);
    if (m.series && m.value !== null) sparkline(m.series, x + 18, top + 98, width - 36, Math.max(28, height - 138));
    if (caption) text(caption, x + 18, top + height - 24, 10, regular, muted, width - 36);
    if (m.value === null) text(m.unavailableReason || "მაჩვენებელი წყარომ არ მოგვაწოდა", x + 18, top + 92, 10, regular, muted, width - 36);
  }
  function bars(title: string, data: Breakdown[], x: number, top: number, width: number, rowHeight = 32) {
    text(title, x, top, 16, bold);
    if (!data.length) { text("მონაცემები მიუწვდომელია", x, top + 40, 12, regular, muted); return; }
    data.forEach((item, i) => {
      const y = top + 40 + i * rowHeight;
      text(item.label, x, y, 11, regular, ink, width * 0.42);
      box(x + width * 0.45, y + 5, width * 0.36, 5, line);
      box(x + width * 0.45, y + 5, width * 0.36 * Math.max(0, Math.min(100, item.value)) / 100, 5, red);
      text(`${item.value}%`, x + width * 0.84, y - 1, 11, bold, ink, width * 0.16);
    });
  }
  function note(value: string) { text(value, 40, 467, 10, regular, muted, 880); }
  const fullPeriod = selectWindow(snapshot, 28);
  const reportPeriod = `ბოლო 28 დღე: ${dateRange(fullPeriod.start, fullPeriod.end)}`;

  addPage("", "");
  const dims = logo.scaleToFit(190, 180);
  page!.drawImage(logo, { x: 385 + (190 - dims.width) / 2, y: 280, width: dims.width, height: dims.height });
  text("HUNGRYMAN", 240, 275, 48, bold, ink, 480);
  text("არხისა და სოციალური ქსელების ანალიტიკა", 240, 344, 19, regular, muted, 650);
  text("28 / 90 / 365 დღე", 240, 382, 16, bold, red);
  if (snapshot.mode === "demo") note("საცდელი ანგარიში - ყველა რიცხვი საილუსტრაციოა; პლატფორმები ჯერ არ არის დაკავშირებული.");
  else note(`ამ ანგარიშში დაფიქსირებულია ერთი ამონაწერი: ${snapshot.id}`);

  addPage("ჩვენი აუდიტორია", "თითოეული პლატფორმის გამომწერები და ვიდეოების საშუალო ნახვები");
  [snapshot.tiktok, snapshot.instagram, snapshot.facebook, snapshot.youtube].forEach((p, i) => {
    const x = 40 + (i % 2) * 450, y = 146 + Math.floor(i / 2) * 150;
    box(x, y, 430, 132);
    text(p.name, x + 20, y + 14, 16, bold, red);
    text(formatMetric(p.followers), x + 20, y + 44, 32, bold);
    text("გამომწერი", x + 20, y + 89, 11, regular, muted);
    text(`საშუალო ნახვები: ${formatMetric(p.averageViews)}`, x + 205, y + 57, 12, regular, ink, 205);
    text(p.state === "demo" ? "საცდელი" : p.state === "unavailable" ? "დასაკავშირებელია" : p.dataThrough || "", x + 205, y + 89, 10, regular, muted, 205);
  });
  note("სხვადასხვა პლატფორმის აუდიტორია შეიძლება გადაიკვეთოს; გამომწერები ერთ ჯამად არ არის შეკრებილი.");

  function windowsPage(title: string, key: "views" | "duration" | "unique" | "impressions", days: WindowDays[]) {
    addPage(title, "YouTube / თითოეული პერიოდი დამოუკიდებლად არის დათვლილი", snapshot.youtube);
    const width = days.length === 3 ? 280 : 430;
    days.forEach((d, i) => {
      const window = selectWindow(snapshot, d);
      const x = 40 + i * (width + 20);
      text(`ბოლო ${d} დღე`, x, 145, 16, bold, red);
      metricCard(window[key], x, 181, width, 240, dateRange(window.start, window.end));
    });
    note(key === "unique" ? "უნიკალური მაყურებლები პერიოდებს შორის არ ჯამდება. მიუწვდომელი მაჩვენებელი ნულით არ ჩანაცვლდება." : "პერიოდები სრულდება წყაროს უახლესი ხელმისაწვდომი მონაცემების თარიღზე.");
  }
  windowsPage("ნახვები", "views", [28, 90, 365]);
  windowsPage("ყურების საშუალო ხანგრძლივობა", "duration", [28, 90, 365]);
  windowsPage("უნიკალური მაყურებლები", "unique", [28, 90]);
  windowsPage("ვიდეოების ჩვენებები", "impressions", [28, 90, 365]);

  addPage("ასაკი / სქესი / გეოგრაფია", `YouTube / ${reportPeriod}`, snapshot.youtube);
  bars("ასაკი", snapshot.youtube.age, 40, 150, 265);
  bars("სქესი", snapshot.youtube.gender, 345, 150, 240);
  bars("ქვეყნები", snapshot.youtube.countries, 625, 150, 295);
  note("პროცენტები ეხება შესაბამისი წყაროს მიერ გაზომილ აუდიტორიას.");

  addPage("Facebook / სტატისტიკა", reportPeriod, snapshot.facebook);
  snapshot.facebook.metrics.slice(0, 4).forEach((m, i) => metricCard(m, 40 + (i % 2) * 450, 146 + Math.floor(i / 2) * 151, 430, 132));
  note("Facebook-ის მონაცემების ავტომატური განახლებისთვის საჭიროა შესაბამისი გვერდის დაკავშირება.");

  addPage("Instagram / სტატისტიკა და აუდიტორია", reportPeriod, snapshot.instagram);
  metricCard(snapshot.instagram.followers, 40, 145, 245, 115);
  snapshot.instagram.metrics.forEach((m, i) => {
    const y = 279 + i * 20;
    text(m.label, 40, y, 9, regular, muted, 165);
    text(formatMetric(m), 205, y, 10, bold, ink, 80);
  });
  bars("ასაკი", snapshot.instagram.age, 330, 150, 265, 30);
  bars("ქალაქები", snapshot.instagram.cities, 635, 150, 285, 30);
  bars("სქესი", snapshot.instagram.gender, 635, 366, 285, 27);

  addPage("Facebook / აუდიტორია", reportPeriod, snapshot.facebook);
  bars("სქესი", snapshot.facebook.gender, 40, 148, 265, 28);
  bars("ასაკი", snapshot.facebook.age, 40, 268, 265, 24);
  bars("ქალაქები", snapshot.facebook.cities, 345, 148, 265);
  bars("ქვეყნები", snapshot.facebook.countries, 650, 148, 270);
  note("ანგარიში ასახავს შექმნისას ხელმისაწვდომ მონაცემებს. ახალი ასლის მისაღებად ჩამოტვირთე ხელახლა.");
  return pdf.save();
}
