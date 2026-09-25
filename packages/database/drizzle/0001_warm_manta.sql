CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`last_four` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `api_keys_created_at` ON `api_keys` (`created_at`);--> statement-breakpoint
CREATE TABLE `dashboard_password` (
	`id` integer PRIMARY KEY NOT NULL,
	`hash` text NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "dashboard_password_single_row" CHECK("dashboard_password"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `sessions_created_at` ON `sessions` (`created_at`);