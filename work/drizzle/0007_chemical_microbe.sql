CREATE TABLE `staff_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created` integer NOT NULL,
	`expires` integer NOT NULL,
	`last_seen` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `staff_sessions_user_idx` ON `staff_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `staff_sessions_expires_idx` ON `staff_sessions` (`expires`);--> statement-breakpoint
ALTER TABLE `team_members` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `team_members` ADD `password_salt` text;