import type { CalendarEvent, Person } from "./types";
export type ManagedEvent = CalendarEvent & {
  employee_email: string | null;
  visibility: string;
};
export type Metric = {
  email: string;
  fullName: string;
  role: string;
  workedDays: number;
  workedHours: number;
  restDays: number;
  overtimeHours: number;
  leaveDays: number;
  leaveRemaining: number;
};
export type CalendarAdminData = {
  month: string;
  events: ManagedEvent[];
  people: Person[];
  metrics: Metric[];
  calendarTotals: { workDays: number; workHours: number; restDays: number };
  patterns: {
    id: string;
    employee_email: string;
    effective_from: string;
    schedule_json: string;
    break_minutes: number;
    updated: number;
  }[];
  entitlements: {
    employee_email: string;
    year: number;
    allowance_days: number;
    carryover_days: number;
  }[];
};
