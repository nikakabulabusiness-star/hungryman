// Intl formatter construction is expensive on Hermes (it goes through the
// platform ICU/NSDateFormatter bridge). Reuse one instance per locale+options.
const formatters = new Map<string, Intl.DateTimeFormat>();
export function dateFormatter(locale: string, options: Intl.DateTimeFormatOptions) {
  const key = locale + JSON.stringify(options);
  let value = formatters.get(key);
  if (!value) {
    value = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, value);
  }
  return value;
}
export function formatDate(value: number | string | Date, locale: string, options: Intl.DateTimeFormatOptions) {
  return dateFormatter(locale, options).format(value instanceof Date ? value : new Date(value));
}
const TODAY = { timeZone: "Asia/Tbilisi", year: "numeric", month: "2-digit", day: "2-digit" } as const;
export function today() {
  return dateFormatter("en-CA", TODAY).format(new Date());
}
const DATE_LABEL = { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Tbilisi" } as const;
export function dateLabel(date: string) {
  return dateFormatter("ka-GE", DATE_LABEL).format(new Date(date + "T12:00:00Z"));
}
export function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  return {
    from: month + "-01",
    to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10),
  };
}
export function moveMonth(month: string, amount: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + amount, 1)).toISOString().slice(0, 7);
}
export function occurs(
  event: { start_date: string; end_date: string; recurring_yearly: number },
  date: string,
) {
  if (!event.recurring_yearly)
    return date >= event.start_date && date <= event.end_date;
  const current = date.slice(5),
    from = event.start_date.slice(5),
    to = event.end_date.slice(5);
  return from <= to
    ? current >= from && current <= to
    : current >= from || current <= to;
}
export const kindLabels: Record<string, string> = {
  birthday: "დაბადების დღე",
  shoot: "გადაღება",
  shorts: "მოკლე ვიდეოს გადაღება",
  sick: 'ბიულეტენი', leave: "შვებულება",
  holiday: "დღესასწაული",
  day_off: "დასვენება",
  overtime: "ოვერთაიმი",
  salary: "ხელფასი",
  info: "ინფორმაცია",
};
