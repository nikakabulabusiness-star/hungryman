// One immutable snapshot is shared by the screen and every page of its PDF.
// Replace this demo provider with an authenticated server provider after OAuth.
// Never fill a missing live metric with a demo number or with zero.
export type WindowDays = 7 | 28 | 90 | 365;
export type DataState = "demo" | "live" | "unavailable";
export type Metric = {
  label: string;
  value: number | null;
  unit?: "seconds" | "percent" | "hours";
  series?: number[];
  unavailableReason?: string;
};
export type Breakdown = { label: string; value: number };
export type WindowReport = {
  days: WindowDays;
  start: string;
  end: string;
  views: Metric;
  duration: Metric;
  unique: Metric;
  impressions: Metric;
  watchHours: Metric;
};
export type PlatformReport = {
  name: string;
  state: DataState;
  dataThrough: string | null;
  followers: Metric;
  averageViews: Metric;
  metrics: Metric[];
  age: Breakdown[];
  gender: Breakdown[];
  cities: Breakdown[];
  countries: Breakdown[];
};
export type ChannelSnapshot = {
  id: string;
  channel: string;
  handle: string;
  mode: "demo" | "live";
  fetchedAt: string | null;
  dataThrough: string;
  windows: WindowReport[];
  youtube: PlatformReport;
  facebook: PlatformReport;
  instagram: PlatformReport;
  tiktok: PlatformReport;
  videos: { title: string; views: number }[];
};

const DEMO_THROUGH = "2026-10-22";
const metric = (label: string, value: number | null, unit?: Metric["unit"]): Metric => ({ label, value, unit });
const breakdown = (rows: [string, number][]): Breakdown[] => rows.map(([label, value]) => ({ label, value }));
function trend(total: number, points: number) {
  const weights = Array.from({ length: points }, (_, i) => 0.7 + (i % 7) / 7 + (i % 11 === 0 ? 1.8 : 0));
  const sum = weights.reduce((a, b) => a + b, 0);
  const values = weights.map((n) => Math.floor((n / sum) * total));
  values[values.length - 1] += total - values.reduce((a, b) => a + b, 0);
  return values;
}
function windowReport(days: WindowDays, views: number, duration: number, unique: number, impressions: number): WindowReport {
  const start = new Date(`${DEMO_THROUGH}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return {
    days, start: start.toISOString().slice(0, 10), end: DEMO_THROUGH,
    views: { ...metric("ნახვები", views), series: trend(views, days) },
    duration: metric("ყურების საშუალო ხანგრძლივობა", duration, "seconds"),
    unique: metric("უნიკალური მაყურებლები", unique),
    impressions: { ...metric("ვიდეოების ჩვენებები", impressions), series: trend(impressions, days) },
    watchHours: metric("ყურების დრო", Math.round(views * duration / 3600), "hours"),
  };
}
function platform(name: string, followers: number, averageViews: number): PlatformReport {
  return {
    name, state: "demo", dataThrough: DEMO_THROUGH,
    followers: metric("გამომწერები", followers), averageViews: metric("საშუალო ნახვები", averageViews),
    metrics: [], age: [], gender: [], cities: [], countries: [],
  };
}

// Illustrative fixtures, not copied from the 2025 report and not current channel data.
function demoSnapshot(): ChannelSnapshot {
  const youtube = platform("YouTube", 624790, 650000);
  youtube.age = breakdown([["13-17", 10], ["18-24", 39], ["25-34", 29], ["35-44", 14], ["45-54", 5], ["55-64", 2], ["65+", 1]]);
  youtube.gender = breakdown([["კაცი", 64], ["ქალი", 36]]);
  youtube.countries = breakdown([["საქართველო", 94.6], ["გერმანია", 1.4], ["აშშ", 1.2], ["საფრანგეთი", 0.9], ["იტალია", 0.8], ["სხვა", 1.1]]);
  const facebook = platform("Facebook", 325000, 180000);
  facebook.metrics = [metric("პოსტების მიღწევა", 1288454), metric("რეაქციები, კომენტარები და გაზიარებები", 617970), metric("1-წუთიანი ვიდეონახვები", 960039), metric("3-წამიანი ვიდეონახვები", 2700067)];
  facebook.age = breakdown([["13-17", 6], ["18-24", 23], ["25-34", 39], ["35-44", 21], ["45-54", 8], ["55-64", 2], ["65+", 1]]);
  facebook.gender = breakdown([["ქალი", 50.9], ["კაცი", 49.1]]);
  facebook.cities = breakdown([["თბილისი", 51], ["ბათუმი", 8], ["ქუთაისი", 7], ["რუსთავი", 5], ["გორი", 3], ["სხვა", 26]]);
  facebook.countries = breakdown([["საქართველო", 91], ["იტალია", 2], ["გერმანია", 1], ["აშშ", 1], ["საფრანგეთი", 1], ["სხვა", 4]]);
  const instagram = platform("Instagram", 87000, 170000);
  instagram.metrics = [metric("ჩვენებები", 1482870), metric("მიღწეული ანგარიშები", 113258), metric("პროფილის აქტივობა", 10533), metric("პროფილის ვიზიტები", 10450), metric("გარე ბმულზე გადასვლები", 67), metric("ელფოსტის ღილაკზე დაჭერები", 16), metric("მატება (წმინდა)", 1918), metric("ახალი გამომწერები", 5214), metric("გამოწერის გაუქმება", 3296)];
  instagram.age = breakdown([["13-17", 12], ["18-24", 40.2], ["25-34", 34.4], ["35-44", 9.3], ["45-54", 2.2], ["55-64", 0.6], ["65+", 1.3]]);
  instagram.gender = breakdown([["კაცი", 52.4], ["ქალი", 47.6]]);
  instagram.cities = breakdown([["თბილისი", 58.8], ["ბათუმი", 6.5], ["ქუთაისი", 4.3], ["რუსთავი", 4.2], ["სხვა", 26.2]]);
  return {
    id: "demo-2026-10-22-v1", channel: "Hungryman", handle: "@hungrymantv",
    mode: "demo", fetchedAt: null, dataThrough: DEMO_THROUGH,
    windows: [windowReport(7, 980000, 492, 285000, 12200000), windowReport(28, 3300000, 502, 780000, 42725946), windowReport(90, 9786615, 485, 1954617, 120285715), windowReport(365, 37215162, 469, 5350000, 469393738)],
    youtube, facebook, instagram, tiktok: platform("TikTok", 411000, 280000),
    videos: [{ title: "55 საათი უდაბნოში", views: 842000 }, { title: "600K Special", views: 615000 }],
  };
}

export type AnalyticsProvider = () => Promise<ChannelSnapshot>;
export const loadChannelSnapshot: AnalyticsProvider = async () => demoSnapshot();

export function selectWindow(snapshot: ChannelSnapshot, days: WindowDays) {
  const result = snapshot.windows.find((item) => item.days === days);
  if (!result) throw new Error("ამ პერიოდის მონაცემები მიუწვდომელია.");
  return result;
}
export function formatMetric(m: Metric): string {
  if (m.value === null || !Number.isFinite(m.value)) return "მიუწვდომელია";
  if (m.unit === "seconds") return `${Math.floor(m.value / 60)}:${String(Math.round(m.value % 60)).padStart(2, "0")}`;
  const n = new Intl.NumberFormat("en-US", { maximumFractionDigits: m.unit === "percent" ? 1 : 0 }).format(m.value);
  return `${n}${m.unit === "percent" ? "%" : m.unit === "hours" ? " სთ" : ""}`;
}
export function tbilisiTimestamp(value: string | Date) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tbilisi", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}
export function reportFilename(generatedAt: Date) {
  // YYYY-MM-DD + local time, no user text in filesystem paths.
  const local = new Date(generatedAt.getTime() + 4 * 3600_000).toISOString().replace(/[:.]/g, "-").slice(0, 23);
  return `Hungryman-Analytics-${local}-GET.pdf`;
}

export async function prepareChannelReport(provider: AnalyticsProvider, now = () => new Date()) {
  // Fetch on every export. A failure propagates; never silently export an older screen cache.
  const fresh = await provider();
  const snapshot: ChannelSnapshot = JSON.parse(JSON.stringify(fresh));
  return { snapshot, generatedAt: now() };
}
