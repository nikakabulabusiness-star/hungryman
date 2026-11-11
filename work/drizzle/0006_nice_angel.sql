CREATE TABLE `staff_calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`employee_user_id` text,
	`employee_name` text,
	`recurring_yearly` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL,
	`created_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `staff_calendar_dates_idx` ON `staff_calendar_events` (`start_date`,`end_date`);--> statement-breakpoint
CREATE INDEX `staff_calendar_employee_idx` ON `staff_calendar_events` (`employee_user_id`,`kind`);--> statement-breakpoint
ALTER TABLE `team_members` ADD `avatar_key` text;