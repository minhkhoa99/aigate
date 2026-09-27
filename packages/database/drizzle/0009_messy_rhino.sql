PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_provider_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`name` text NOT NULL,
	`api_key_sealed` text NOT NULL,
	`key_hint` text NOT NULL,
	`base_url` text,
	`deployment` text,
	`api_version` text,
	`organization` text,
	`account_id` text,
	`auth_type` text DEFAULT 'api-key' NOT NULL,
	`refresh_token_sealed` text,
	`expires_at` integer,
	`last_refresh_at` integer,
	`email` text,
	`oauth_data` text,
	`is_active` integer DEFAULT true NOT NULL,
	`test_status` text DEFAULT 'untested' NOT NULL,
	`last_error` text,
	`last_error_code` text,
	`last_tested_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "provider_connections_test_status" CHECK(test_status IN ('untested', 'active', 'invalid', 'no_quota', 'unreachable')),
	CONSTRAINT "provider_connections_auth_type" CHECK(auth_type IN ('api-key', 'oauth'))
);
--> statement-breakpoint
INSERT INTO `__new_provider_connections`("id", "provider", "name", "api_key_sealed", "key_hint", "base_url", "deployment", "api_version", "organization", "account_id", "is_active", "test_status", "last_error", "last_error_code", "last_tested_at", "created_at", "updated_at") SELECT "id", "provider", "name", "api_key_sealed", "key_hint", "base_url", "deployment", "api_version", "organization", "account_id", "is_active", "test_status", "last_error", "last_error_code", "last_tested_at", "created_at", "updated_at" FROM `provider_connections`;--> statement-breakpoint
DROP TABLE `provider_connections`;--> statement-breakpoint
ALTER TABLE `__new_provider_connections` RENAME TO `provider_connections`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `provider_connections_provider_unique` ON `provider_connections` (`provider`);