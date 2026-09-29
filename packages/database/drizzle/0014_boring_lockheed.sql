CREATE TABLE `account_locks` (
	`connection_id` text NOT NULL,
	`model` text NOT NULL,
	`until` integer NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `provider_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_locks_connection_model` ON `account_locks` (`connection_id`,`model`);--> statement-breakpoint
CREATE INDEX `account_locks_until` ON `account_locks` (`until`);--> statement-breakpoint
DROP INDEX `provider_connections_provider_unique`;--> statement-breakpoint
ALTER TABLE `provider_connections` ADD `priority` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_connections` ADD `last_used_at` integer;--> statement-breakpoint
ALTER TABLE `provider_connections` ADD `consecutive_use_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `provider_connections_provider_active_priority` ON `provider_connections` (`provider`,`is_active`,`priority`);