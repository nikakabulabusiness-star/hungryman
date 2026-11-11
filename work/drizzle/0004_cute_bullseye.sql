CREATE TABLE `admin_users` (
	`email` text PRIMARY KEY NOT NULL,
	`created` integer NOT NULL,
	`created_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`birth_date` text NOT NULL,
	`personal_number` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`position` text NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL
);
