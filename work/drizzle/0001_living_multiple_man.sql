CREATE TABLE `recruitment_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created` integer NOT NULL,
	`role` text NOT NULL,
	`kind` text NOT NULL,
	`visitor` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recruitment_events_created_idx` ON `recruitment_events` (`created`);--> statement-breakpoint
CREATE INDEX `recruitment_events_role_kind_idx` ON `recruitment_events` (`role`,`kind`);--> statement-breakpoint
CREATE TABLE `vacancies` (
	`role` text PRIMARY KEY NOT NULL,
	`is_open` integer DEFAULT 1 NOT NULL,
	`deadline` text,
	`updated` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `applications` ADD `status` text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE `applications` ADD `rating` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `applications` ADD `admin_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `applications` ADD `updated` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `applications_status_created_idx` ON `applications` (`status`,`created`);--> statement-breakpoint
CREATE INDEX `applications_position_created_idx` ON `applications` (`position`,`created`);--> statement-breakpoint
PRAGMA optimize;
