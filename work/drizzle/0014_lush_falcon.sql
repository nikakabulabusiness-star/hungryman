CREATE TABLE `staff_positions` (
	`name` text PRIMARY KEY NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL,
	`updated_by` text NOT NULL
);
