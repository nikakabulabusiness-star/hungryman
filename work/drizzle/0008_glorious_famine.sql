ALTER TABLE `admin_users` ADD `role` text DEFAULT 'HR' NOT NULL;--> statement-breakpoint
ALTER TABLE `admin_users` ADD `status` text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
CREATE INDEX `admin_users_role_status_idx` ON `admin_users` (`role`,`status`);