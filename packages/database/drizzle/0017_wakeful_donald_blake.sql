CREATE TABLE `provider_proxy_strategies` (
	`provider_id` text PRIMARY KEY NOT NULL,
	`rotate_strategy` text DEFAULT 'none' NOT NULL,
	`proxy_pool_id` text,
	FOREIGN KEY (`proxy_pool_id`) REFERENCES `proxy_pools`(`id`) ON UPDATE no action ON DELETE set null
);
