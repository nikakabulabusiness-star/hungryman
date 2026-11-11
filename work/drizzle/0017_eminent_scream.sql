CREATE TABLE `chat_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`object_key` text NOT NULL,
	`mime` text NOT NULL,
	`name` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_call_responses` (
	`call_id` text NOT NULL,
	`user_id` text NOT NULL,
	`response` text NOT NULL,
	`updated` integer NOT NULL,
	PRIMARY KEY(`call_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `chat_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`created_by` text NOT NULL,
	`creator_name` text NOT NULL,
	`room` text NOT NULL,
	`created` integer NOT NULL,
	`ended` integer
);
--> statement-breakpoint
CREATE INDEX `chat_calls_thread_created_idx` ON `chat_calls` (`conversation_id`,`created`);--> statement-breakpoint
CREATE TABLE `chat_reads` (
	`conversation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`last_read` integer DEFAULT 0 NOT NULL,
	`typing_until` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`conversation_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `chat_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_a` text NOT NULL,
	`user_b` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_threads_pair_idx` ON `chat_threads` (`user_a`,`user_b`);--> statement-breakpoint
ALTER TABLE `staff_chat_messages` ADD `conversation_id` text DEFAULT 'team' NOT NULL;--> statement-breakpoint
ALTER TABLE `staff_chat_messages` ADD `reply_to` text;--> statement-breakpoint
ALTER TABLE `staff_chat_messages` ADD `attachment_id` text;--> statement-breakpoint
CREATE INDEX `staff_chat_thread_created_idx` ON `staff_chat_messages` (`conversation_id`,`created`,`id`);