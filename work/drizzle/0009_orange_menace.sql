CREATE TABLE `shoot_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`shoot_id` text NOT NULL,
	`assignee_email` text NOT NULL,
	`assignee_name` text NOT NULL,
	`assignee_role` text NOT NULL,
	`task` text NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `shoot_tasks_shoot_idx` ON `shoot_tasks` (`shoot_id`);--> statement-breakpoint
CREATE INDEX `shoot_tasks_assignee_idx` ON `shoot_tasks` (`assignee_email`,`status`);--> statement-breakpoint
CREATE TABLE `shoots` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`shoot_date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text,
	`location_name` text DEFAULT '' NOT NULL,
	`location_url` text,
	`details` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `shoots_date_status_idx` ON `shoots` (`shoot_date`,`status`);--> statement-breakpoint
CREATE INDEX `shoots_created_by_idx` ON `shoots` (`created_by`);--> statement-breakpoint
CREATE TABLE `staff_chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`author_user_id` text NOT NULL,
	`author_email` text NOT NULL,
	`author_name` text NOT NULL,
	`author_role` text NOT NULL,
	`body` text NOT NULL,
	`kind` text DEFAULT 'message' NOT NULL,
	`reference_id` text,
	`created` integer NOT NULL,
	`pinned` integer DEFAULT 0 NOT NULL,
	`pinned_by` text,
	`pinned_at` integer
);
--> statement-breakpoint
CREATE INDEX `staff_chat_created_idx` ON `staff_chat_messages` (`created`,`id`);--> statement-breakpoint
CREATE INDEX `staff_chat_pinned_idx` ON `staff_chat_messages` (`pinned`,`pinned_at`);--> statement-breakpoint
ALTER TABLE `admin_users` ADD `can_create_shoots` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `admin_users` ADD `can_edit_shoots` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `staff_calendar_events` ADD `employee_email` text;--> statement-breakpoint
CREATE INDEX `staff_calendar_employee_email_idx` ON `staff_calendar_events` (`employee_email`,`kind`);--> statement-breakpoint
ALTER TABLE `team_members` ADD `last_seen` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `team_members_last_seen_idx` ON `team_members` (`last_seen`);