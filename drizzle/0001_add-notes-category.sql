PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_activities` (
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
	CONSTRAINT "activity_title" CHECK(length(trim("__new_activities"."title")) between 1 and 120),
	CONSTRAINT "activity_description" CHECK(length("__new_activities"."description") <= 2000),
	CONSTRAINT "activity_category" CHECK("__new_activities"."category" in ('Livros','Filmes e séries','Cursos','Projetos','Lugares','Anotações e observações','Outros')),
	CONSTRAINT "activity_status" CHECK("__new_activities"."status" in ('Quero fazer','Em andamento','Concluído'))
);
--> statement-breakpoint
INSERT INTO `__new_activities`("id", "profile_id", "title", "description", "category", "status", "image_url", "link_url", "created_at", "updated_at") SELECT "id", "profile_id", "title", "description", "category", "status", "image_url", "link_url", "created_at", "updated_at" FROM `activities`;--> statement-breakpoint
DROP TABLE `activities`;--> statement-breakpoint
ALTER TABLE `__new_activities` RENAME TO `activities`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `activities_profile_status` ON `activities` (`profile_id`,`status`);--> statement-breakpoint
CREATE INDEX `activities_profile_category` ON `activities` (`profile_id`,`category`);