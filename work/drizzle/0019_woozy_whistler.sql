CREATE TABLE `chat_preferences` (
	`conversation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`muted` integer DEFAULT 0 NOT NULL,
	`updated` integer NOT NULL,
	PRIMARY KEY(`conversation_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `shoot_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`object_key` text NOT NULL,
	`mime` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `chat_attachments` ADD `duration_ms` integer;--> statement-breakpoint
ALTER TABLE `shoots` ADD `photo_id` text;--> statement-breakpoint
ALTER TABLE `staff_chat_messages` ADD `duration_ms` integer;