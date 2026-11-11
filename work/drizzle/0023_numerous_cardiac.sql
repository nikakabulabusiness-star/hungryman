CREATE TABLE `attendance_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`employee_name` text NOT NULL,
	`work_date` text NOT NULL,
	`answer` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`response` text DEFAULT '' NOT NULL,
	`created` integer NOT NULL,
	`resolved` integer,
	`resolved_by` text,
	`decision_token` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_request_day_idx` ON `attendance_requests` (`user_id`,`work_date`);--> statement-breakpoint
CREATE INDEX `attendance_request_status_idx` ON `attendance_requests` (`status`,`created`);--> statement-breakpoint
CREATE TABLE `chat_deleted_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`deleted` integer NOT NULL,
	`deleted_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_hidden_threads` (
	`conversation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`cleared_before` integer NOT NULL,
	`hidden` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`conversation_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `place_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`object_key` text NOT NULL,
	`mime` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `work_notification_deliveries` (
	`notification_id` text NOT NULL,
	`token` text NOT NULL,
	`sent` integer,
	`claimed` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	`ticket` text,
	PRIMARY KEY(`notification_id`, `token`)
);
--> statement-breakpoint
CREATE INDEX `work_delivery_pending_idx` ON `work_notification_deliveries` (`sent`,`claimed`);--> statement-breakpoint
CREATE TABLE `work_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`target` text NOT NULL,
	`target_id` text DEFAULT '' NOT NULL,
	`important` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL,
	`read_at` integer,
	`push_enabled` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `work_notice_user_read_idx` ON `work_notifications` (`user_id`,`read_at`,`created`);--> statement-breakpoint
CREATE INDEX `work_notice_created_idx` ON `work_notifications` (`created`);--> statement-breakpoint
CREATE TABLE `workspace_places` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`url` text,
	`photo_id` text,
	`created` integer NOT NULL,
	`updated` integer NOT NULL,
	`updated_by` text NOT NULL
);

--> statement-breakpoint
UPDATE staff_positions SET permissions_json=json_insert(permissions_json,'$[#]','chat.delete_group') WHERE name IN ('HR','Owner','პროდიუსერი','კრეატიული დირექტორი') AND permissions_json IS NOT NULL AND json_valid(permissions_json) AND NOT EXISTS(SELECT 1 FROM json_each(permissions_json) WHERE value='chat.delete_group');
--> statement-breakpoint
UPDATE staff_positions SET permissions_json=json_insert(permissions_json,'$[#]','map.manage') WHERE name IN ('HR','Owner') AND permissions_json IS NOT NULL AND json_valid(permissions_json) AND NOT EXISTS(SELECT 1 FROM json_each(permissions_json) WHERE value='map.manage');

--> statement-breakpoint
CREATE TABLE `push_deliveries` (`message_id` text NOT NULL, `token` text NOT NULL, `user_id` text NOT NULL, `sent` integer, `attempts` integer DEFAULT 0 NOT NULL, `ticket` text, PRIMARY KEY (`message_id`,`token`));

--> statement-breakpoint
ALTER TABLE `push_deliveries` ADD `receipt_checked` integer;
--> statement-breakpoint
ALTER TABLE `push_deliveries` ADD `receipt_error` text;
--> statement-breakpoint
ALTER TABLE `work_notification_deliveries` ADD `receipt_checked` integer;
--> statement-breakpoint
ALTER TABLE `work_notification_deliveries` ADD `receipt_error` text;
