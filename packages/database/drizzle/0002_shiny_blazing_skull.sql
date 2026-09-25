CREATE TABLE `provider_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`name` text NOT NULL,
	`api_key_sealed` text NOT NULL,
	`key_hint` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`test_status` text DEFAULT 'untested' NOT NULL,
	`last_error` text,
	`last_error_code` text,
	`last_tested_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "provider_connections_test_status" CHECK(test_status IN ('untested', 'active', 'invalid', 'no_quota', 'unreachable'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_connections_provider_unique` ON `provider_connections` (`provider`);