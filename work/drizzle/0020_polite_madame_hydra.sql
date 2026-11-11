CREATE TABLE `chat_group_members` (
	`conversation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined` integer NOT NULL,
	PRIMARY KEY(`conversation_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `chat_group_user_idx` ON `chat_group_members` (`user_id`,`conversation_id`);--> statement-breakpoint
CREATE TABLE `chat_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`created_by` text NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_mentions` (
	`message_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`message_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `chat_mentions_user_idx` ON `chat_mentions` (`user_id`,`message_id`);--> statement-breakpoint
CREATE TABLE `private_calendar_notes` (
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`body` text NOT NULL,
	`updated` integer NOT NULL,
	PRIMARY KEY(`user_id`, `date`)
);
--> statement-breakpoint
CREATE TABLE `social_monthly_metrics` (
	`platform` text NOT NULL,
	`month` text NOT NULL,
	`followers` integer,
	`views` integer,
	`likes` integer,
	`comments` integer,
	`shares` integer,
	`posts` integer,
	`source` text DEFAULT 'manual' NOT NULL,
	`updated` integer NOT NULL,
	`updated_by` text NOT NULL,
	PRIMARY KEY(`platform`, `month`)
);
--> statement-breakpoint
CREATE TABLE `staff_day_off_entitlements` (
	`email` text NOT NULL,
	`year` integer NOT NULL,
	`days` real NOT NULL,
	`updated` integer NOT NULL,
	`updated_by` text NOT NULL,
	PRIMARY KEY(`email`, `year`)
);
--> statement-breakpoint
CREATE TABLE `staff_time_off_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`employee_name` text NOT NULL,
	`kind` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created` integer NOT NULL,
	`resolved` integer,
	`resolved_by` text,
	`response` text DEFAULT '' NOT NULL,
	`decision_token` text,
	`seen` integer
);
--> statement-breakpoint
CREATE INDEX `time_off_user_dates_idx` ON `staff_time_off_requests` (`user_id`,`start_date`,`end_date`);--> statement-breakpoint
CREATE INDEX `time_off_status_created_idx` ON `staff_time_off_requests` (`status`,`created`);