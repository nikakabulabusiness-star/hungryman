-- One-time user-requested reset. Preserve messages, applications, manual records, schedules and attendance modes.
DELETE FROM events WHERE created_at <= 1793028982937;
--> statement-breakpoint
DELETE FROM visitors WHERE first_seen <= 1793028982937;
