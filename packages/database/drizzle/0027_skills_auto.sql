CREATE TABLE `skill_index` (
	`skill_id` text PRIMARY KEY NOT NULL,
	`link_content` text,
	`fetched_at` integer,
	`fetch_error` text,
	`document` text NOT NULL,
	`indexed_at` integer NOT NULL,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `settings` ADD `skills_auto_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `skills_max_selected` integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `skills_budget_chars` integer DEFAULT 8000 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `skills_catalog_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `skills` ADD `auto` integer DEFAULT true NOT NULL;