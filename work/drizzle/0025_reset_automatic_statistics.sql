-- One-time user-requested reset. Preserve messages, applications, manual records, schedules and attendance modes.
DELETE FROM recruitment_events WHERE created <= 1793028982937;
--> statement-breakpoint
DELETE FROM site_visitors WHERE first_seen <= 1793028982937;
--> statement-breakpoint
UPDATE staff_attendance SET office_minutes = 0, first_arrival = NULL, last_departure = NULL, open_since = NULL, last_confirmed = NULL WHERE updated <= 1793028982937;
