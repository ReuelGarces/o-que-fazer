CREATE TABLE `activity_completions` (
	`id` text NOT NULL,
	`profile_id` text NOT NULL,
	`activity_id` text NOT NULL,
	`completed_on` text NOT NULL,
	`completed_at` text NOT NULL,
	`reopened_at` text,
	PRIMARY KEY(`profile_id`, `id`),
	FOREIGN KEY (`profile_id`,`activity_id`) REFERENCES `activities`(`profile_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "completion_date_format" CHECK(length("activity_completions"."completed_on") = 10)
);
--> statement-breakpoint
CREATE INDEX `activity_completions_profile_activity` ON `activity_completions` (`profile_id`,`activity_id`);--> statement-breakpoint
CREATE INDEX `activity_completions_profile_completed` ON `activity_completions` (`profile_id`,`completed_on`);--> statement-breakpoint
ALTER TABLE `activities` ADD `recurrence` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `activities` ADD `recurrence_interval` integer;--> statement-breakpoint
ALTER TABLE `activities` ADD `next_occurrence_on` text;--> statement-breakpoint
ALTER TABLE `activities` ADD `recurrence_anchor_day` integer;