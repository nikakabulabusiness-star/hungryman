CREATE TABLE `site_visitors` (
	`visitor` text PRIMARY KEY NOT NULL,
	`first_seen` integer NOT NULL,
	`last_seen` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `site_visitors_last_seen_idx` ON `site_visitors` (`last_seen`);--> statement-breakpoint
PRAGMA optimize;
