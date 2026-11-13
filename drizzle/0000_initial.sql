CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_username_unique` ON `accounts` (`username`);--> statement-breakpoint
CREATE TABLE `activities` (
	`id` text NOT NULL,
	`profile_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`status` text NOT NULL,
	`image_url` text NOT NULL,
	`link_url` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`profile_id`, `id`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "activity_title" CHECK(length(trim("activities"."title")) between 1 and 120),
	CONSTRAINT "activity_description" CHECK(length("activities"."description") <= 2000),
	CONSTRAINT "activity_category" CHECK("activities"."category" in ('Livros','Filmes e séries','Cursos','Projetos','Lugares','Outros')),
	CONSTRAINT "activity_status" CHECK("activities"."status" in ('Quero fazer','Em andamento','Concluído'))
);
--> statement-breakpoint
CREATE INDEX `activities_profile_status` ON `activities` (`profile_id`,`status`);--> statement-breakpoint
CREATE INDEX `activities_profile_category` ON `activities` (`profile_id`,`category`);--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`avatar` text DEFAULT 'compass' NOT NULL,
	`display_order` integer NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "two_profile_slots" CHECK("profiles"."display_order" in (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_account_order` ON `profiles` (`account_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_expiry` ON `sessions` (`expires_at`);