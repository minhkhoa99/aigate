CREATE TABLE `combos` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`models` text NOT NULL,
	`strategy` text DEFAULT 'fallback' NOT NULL,
	`judge_model` text,
	`min_panel` integer DEFAULT 2 NOT NULL,
	`straggler_grace_ms` integer DEFAULT 8000 NOT NULL,
	`panel_timeout_ms` integer DEFAULT 90000 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `combos_name_unique` ON `combos` (`name`);--> statement-breakpoint
ALTER TABLE `settings` ADD `combo_sticky_limit` integer DEFAULT 1 NOT NULL;