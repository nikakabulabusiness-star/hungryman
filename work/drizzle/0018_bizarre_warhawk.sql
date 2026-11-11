CREATE TABLE `call_members` (
	`call_id` text NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`name` text NOT NULL,
	`seen` integer NOT NULL,
	PRIMARY KEY(`call_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `call_members_seen_idx` ON `call_members` (`seen`);--> statement-breakpoint
CREATE TABLE `call_signals` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`call_id` text NOT NULL,
	`sender` text NOT NULL,
	`recipient` text NOT NULL,
	`recipient_session` text NOT NULL,
	`payload` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `call_signals_id_idx` ON `call_signals` (`id`);--> statement-breakpoint
CREATE INDEX `call_signals_poll_idx` ON `call_signals` (`call_id`,`recipient`,`seq`);--> statement-breakpoint
CREATE INDEX `call_signals_created_idx` ON `call_signals` (`created`);--> statement-breakpoint
CREATE TABLE `chat_settings` (
	`conversation_id` text PRIMARY KEY NOT NULL,
	`emoji` text DEFAULT '❤️' NOT NULL,
	`photo_id` text,
	`updated` integer NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `push_devices` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `push_devices_user_idx` ON `push_devices` (`user_id`);--> statement-breakpoint
CREATE TABLE `push_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`sender` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`call_id` text,
	`created` integer NOT NULL,
	`sent` integer,
	`attempts` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `push_outbox_pending_idx` ON `push_outbox` (`sent`,`created`);--> statement-breakpoint
ALTER TABLE `chat_calls` ADD `mode` text DEFAULT 'video' NOT NULL;