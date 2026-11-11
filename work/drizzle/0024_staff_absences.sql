CREATE TABLE `staff_absence_archives` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`employee_user_id` text,
	`employee_email` text NOT NULL,
	`employee_name` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`title` text NOT NULL,
	`created` integer NOT NULL,
	`created_by` text NOT NULL,
	`cancelled` integer NOT NULL,
	`cancelled_by` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `absence_archive_dates_idx` ON `staff_absence_archives` (`start_date`,`end_date`);--> statement-breakpoint
CREATE TABLE `staff_absence_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`absence_id` text NOT NULL,
	`object_key` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created` integer NOT NULL,
	`created_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `absence_documents_absence_idx` ON `staff_absence_documents` (`absence_id`);