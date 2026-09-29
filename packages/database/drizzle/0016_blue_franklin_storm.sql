CREATE TABLE `proxy_pools` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`proxy_url` text NOT NULL,
	`no_proxy` text DEFAULT '' NOT NULL,
	`type` text DEFAULT 'http' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`strict_proxy` integer DEFAULT false NOT NULL,
	`test_status` text DEFAULT 'untested' NOT NULL,
	`last_tested_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `proxy_pools_active_updated` ON `proxy_pools` (`is_active`,`updated_at`);--> statement-breakpoint
ALTER TABLE `provider_connections` ADD `proxy_pool_id` text REFERENCES proxy_pools(id);--> statement-breakpoint
CREATE INDEX `provider_connections_proxy_pool` ON `provider_connections` (`proxy_pool_id`);