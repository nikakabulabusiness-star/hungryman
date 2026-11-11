CREATE TABLE `web_push_deliveries` (
	`event_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`created` integer NOT NULL,
	`sent` integer,
	`claimed` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`event_id`, `subscription_id`),
	FOREIGN KEY (`subscription_id`) REFERENCES `web_push_subscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `web_push_delivery_created_idx` ON `web_push_deliveries` (`created`);--> statement-breakpoint
CREATE TABLE `web_push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`endpoint` text NOT NULL,
	`user_id` text NOT NULL,
	`session_hash` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`updated` integer NOT NULL,
	FOREIGN KEY (`session_hash`) REFERENCES `staff_sessions`(`token_hash`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `web_push_subscriptions_endpoint_unique` ON `web_push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `web_push_user_idx` ON `web_push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `web_push_session_idx` ON `web_push_subscriptions` (`session_hash`);