CREATE TABLE `staff_leave_entitlements` (
	`employee_email` text NOT NULL,
	`year` integer NOT NULL,
	`allowance_days` real DEFAULT 0 NOT NULL,
	`carryover_days` real DEFAULT 0 NOT NULL,
	`updated` integer NOT NULL,
	`updated_by` text NOT NULL,
	PRIMARY KEY(`employee_email`, `year`)
);
--> statement-breakpoint
CREATE INDEX `staff_leave_entitlements_year_idx` ON `staff_leave_entitlements` (`year`,`employee_email`);--> statement-breakpoint
CREATE TABLE `staff_work_patterns` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_email` text NOT NULL,
	`employee_name` text NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`schedule_json` text NOT NULL,
	`break_minutes` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL,
	`created_by` text NOT NULL,
	`updated` integer NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `staff_work_patterns_employee_dates_idx` ON `staff_work_patterns` (`employee_email`,`effective_from`,`effective_to`);--> statement-breakpoint
ALTER TABLE `staff_calendar_events` ADD `visibility` text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE `staff_calendar_events` ADD `start_time` text;--> statement-breakpoint
ALTER TABLE `staff_calendar_events` ADD `end_time` text;--> statement-breakpoint
ALTER TABLE `staff_calendar_events` ADD `duration_minutes` integer;--> statement-breakpoint
ALTER TABLE `staff_calendar_events` ADD `updated` integer;--> statement-breakpoint
ALTER TABLE `staff_calendar_events` ADD `updated_by` text;--> statement-breakpoint
UPDATE `staff_calendar_events`
SET `visibility` = CASE WHEN `employee_email` IS NULL THEN 'all' ELSE 'individual' END,
	`updated` = `created`,
	`updated_by` = `created_by`;--> statement-breakpoint
CREATE INDEX `staff_calendar_visibility_dates_idx` ON `staff_calendar_events` (`visibility`,`start_date`,`end_date`);
