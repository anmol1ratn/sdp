CREATE TABLE `ai_budget` (
	`id` text PRIMARY KEY NOT NULL,
	`spent` integer DEFAULT 0 NOT NULL,
	`cap` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`month` text NOT NULL,
	`fingerprint` text NOT NULL,
	`reserved` integer NOT NULL,
	`charged` integer NOT NULL,
	`settled` integer DEFAULT 0 NOT NULL,
	`result` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `calls_owner_created` ON `ai_calls` (`owner`,`created_at`);--> statement-breakpoint
CREATE TABLE `practice_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`bytes` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attachments_owner` ON `practice_attachments` (`owner`);--> statement-breakpoint
CREATE TABLE `practice_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`submission` text NOT NULL,
	`body` text NOT NULL,
	`challenge` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`submission`) REFERENCES `practice_submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reviews_submission` ON `practice_reviews` (`submission`);--> statement-breakpoint
CREATE TABLE `practice_state` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`stage` integer NOT NULL,
	`body` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`busy` text,
	`busy_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `practice_owner_stage` ON `practice_state` (`owner`,`stage`);--> statement-breakpoint
CREATE TABLE `practice_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`stage` integer NOT NULL,
	`answer` text NOT NULL,
	`attachments` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `submissions_owner_stage` ON `practice_submissions` (`owner`,`stage`);