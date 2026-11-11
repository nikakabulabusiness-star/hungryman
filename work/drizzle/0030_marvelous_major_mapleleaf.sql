CREATE TABLE `work_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text DEFAULT '' NOT NULL,
	`position` text DEFAULT '' NOT NULL,
	`phone` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`mutation_id` text DEFAULT '' NOT NULL,
	`deleted` integer
);
--> statement-breakpoint
CREATE INDEX `work_contacts_updated_idx` ON `work_contacts` (`deleted`,`updated`,`id`);--> statement-breakpoint
CREATE TABLE `work_files` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`object_key` text NOT NULL,
	`mime` text NOT NULL,
	`bytes` integer NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `work_files_owner_created` ON `work_files` (`user_id`,`created`);--> statement-breakpoint
CREATE TABLE `work_task_events` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`version` integer NOT NULL,
	`actor_id` text NOT NULL,
	`kind` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_task_events_revision_unique` ON `work_task_events` (`task_id`,`version`);--> statement-breakpoint
CREATE TABLE `work_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`creator_id` text NOT NULL,
	`creator_name` text NOT NULL,
	`assignee_id` text NOT NULL,
	`assignee_name` text NOT NULL,
	`department_id` text DEFAULT '' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`checklist_json` text DEFAULT '[]' NOT NULL,
	`due_date` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL,
	`updated_by` text NOT NULL,
	`mutation_id` text DEFAULT '' NOT NULL,
	`deleted` integer,
	CONSTRAINT "work_tasks_scope" CHECK("work_tasks"."scope" IN ('private','assigned')),
	CONSTRAINT "work_tasks_priority" CHECK("work_tasks"."priority" IN ('low','normal','high')),
	CONSTRAINT "work_tasks_progress" CHECK("work_tasks"."progress" >= 0 AND "work_tasks"."progress" <= 100),
	CONSTRAINT "work_tasks_privacy" CHECK("work_tasks"."scope" != 'private' OR "work_tasks"."creator_id" = "work_tasks"."assignee_id")
);
--> statement-breakpoint
CREATE INDEX `work_tasks_assignee_idx` ON `work_tasks` (`assignee_id`,`scope`,`deleted`,`updated`,`id`);--> statement-breakpoint
CREATE INDEX `work_tasks_creator_idx` ON `work_tasks` (`creator_id`,`scope`,`deleted`,`updated`,`id`);--> statement-breakpoint
CREATE TABLE `work_video_history` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`board` text NOT NULL,
	`action` text NOT NULL,
	`from_stage` text,
	`to_stage` text,
	`comment` text DEFAULT '' NOT NULL,
	`actor_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`created` integer NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `work_videos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `work_video_history_video` ON `work_video_history` (`video_id`,`created`);--> statement-breakpoint
CREATE TABLE `work_video_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`board` text NOT NULL,
	`version` integer NOT NULL,
	`created` integer NOT NULL,
	`actor_name` text NOT NULL,
	`data_json` text NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `work_videos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_video_snapshots_revision_unique` ON `work_video_snapshots` (`video_id`,`board`,`version`);--> statement-breakpoint
CREATE TABLE `work_videos` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`kind` text DEFAULT 'video' NOT NULL,
	`entry_board` text NOT NULL,
	`stages_json` text NOT NULL,
	`content_json` text NOT NULL,
	`callsheet_json` text NOT NULL,
	`technical_json` text NOT NULL,
	`approved_technical_json` text,
	`review_notes_json` text DEFAULT '{}' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL,
	`updated_by` text NOT NULL,
	`mutation_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `work_videos_updated` ON `work_videos` (`updated`,`id`);--> statement-breakpoint
ALTER TABLE `shoots` ADD `work_video_id` text;--> statement-breakpoint
ALTER TABLE `shoots` ADD `work_day_id` text;--> statement-breakpoint
ALTER TABLE `shoots` ADD `content_kind` text DEFAULT 'video' NOT NULL;--> statement-breakpoint
ALTER TABLE `shoots` ADD `work_snapshot` text;--> statement-breakpoint
CREATE UNIQUE INDEX `shoots_work_day` ON `shoots` (`work_video_id`,`work_day_id`) WHERE "shoots"."work_video_id" IS NOT NULL;