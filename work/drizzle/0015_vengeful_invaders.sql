CREATE TABLE `chat_reactions` (
	`message_id` text NOT NULL,
	`user_id` text NOT NULL,
	`emoji` text NOT NULL,
	`created` integer NOT NULL,
	PRIMARY KEY(`message_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `chat_reactions_message_idx` ON `chat_reactions` (`message_id`);--> statement-breakpoint
CREATE TABLE `staff_attendance` (
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`work_date` text NOT NULL,
	`mode` text DEFAULT 'pending' NOT NULL,
	`first_arrival` integer,
	`last_departure` integer,
	`office_minutes` real DEFAULT 0 NOT NULL,
	`open_since` integer,
	`last_confirmed` integer,
	`updated` integer NOT NULL,
	`source` text DEFAULT 'location' NOT NULL,
	PRIMARY KEY(`user_id`, `work_date`)
);
--> statement-breakpoint
CREATE INDEX `attendance_date_idx` ON `staff_attendance` (`work_date`);--> statement-breakpoint
CREATE INDEX `attendance_email_idx` ON `staff_attendance` (`email`,`work_date`);--> statement-breakpoint
CREATE TABLE `workspace_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`details` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workspace_audit_created_idx` ON `workspace_audit` (`created`);--> statement-breakpoint
CREATE TABLE `workspace_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated` integer NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `shoots` ADD `latitude` real;--> statement-breakpoint
ALTER TABLE `shoots` ADD `longitude` real;--> statement-breakpoint
DROP INDEX IF EXISTS `team_members_single_owner`;
