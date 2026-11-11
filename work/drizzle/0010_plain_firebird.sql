CREATE TABLE `auth_rate_limits` (
	`rate_key` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`window_start` integer NOT NULL,
	`attempts` integer DEFAULT 1 NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_rate_limits_updated_idx` ON `auth_rate_limits` (`updated`);--> statement-breakpoint
DELETE FROM `staff_sessions`;--> statement-breakpoint
DELETE FROM `team_members`;--> statement-breakpoint
DELETE FROM `admin_users`;
