CREATE TABLE `auth_email_challenges` (
	`email` text NOT NULL,
	`purpose` text NOT NULL,
	`challenge_id` text NOT NULL,
	`user_id` text,
	`password_version` text,
	`code_hash` text NOT NULL,
	`expires` integer NOT NULL,
	`updated` integer NOT NULL,
	`sent_at` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	`verified_at` integer,
	`grant_hash` text,
	`grant_expires` integer,
	`consumed_at` integer,
	`mutation_id` text,
	PRIMARY KEY(`email`, `purpose`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_email_challenge_id_idx` ON `auth_email_challenges` (`challenge_id`);--> statement-breakpoint
CREATE INDEX `auth_email_cleanup_idx` ON `auth_email_challenges` (`updated`);--> statement-breakpoint
ALTER TABLE `team_members` ADD `email_verified_at` integer;