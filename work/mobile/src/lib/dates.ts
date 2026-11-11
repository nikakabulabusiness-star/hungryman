export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tbilisi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function dateLabel(date: string) {
  return new Date(date + "T12:00:00Z").toLocaleDateString("ka-GE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Tbilisi",
  });
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
