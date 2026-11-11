CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`created` integer NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`position` text NOT NULL,
	`answers` text NOT NULL,
	`file_key` text,
	`file_name` text,
	`file_type` text,
	`submitter` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `applications_created_idx` ON `applications` (`created`);