CREATE TABLE `administrators` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `administrators_email_unique` ON `administrators` (`email`);