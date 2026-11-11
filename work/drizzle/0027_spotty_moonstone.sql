CREATE TABLE `site_administrators` (
	`email` text PRIMARY KEY NOT NULL,
	`granted` integer NOT NULL,
	`granted_by` text NOT NULL
);
