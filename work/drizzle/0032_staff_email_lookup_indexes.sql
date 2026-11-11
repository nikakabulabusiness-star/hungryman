CREATE INDEX `admin_users_email_lower_idx` ON `admin_users` (lower("email"));--> statement-breakpoint
CREATE INDEX `employees_email_lower_idx` ON `employees` (lower("email"));--> statement-breakpoint
CREATE INDEX `team_members_email_lower_idx` ON `team_members` (lower("email"));