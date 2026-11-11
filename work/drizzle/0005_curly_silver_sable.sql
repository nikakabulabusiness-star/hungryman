CREATE TABLE `team_members` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`full_name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`role` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL,
	`approved_by` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_members_email_unique` ON `team_members` (`email`);--> statement-breakpoint
CREATE INDEX `team_members_status_created_idx` ON `team_members` (`status`,`created`);--> statement-breakpoint
CREATE INDEX `team_members_role_idx` ON `team_members` (`role`);