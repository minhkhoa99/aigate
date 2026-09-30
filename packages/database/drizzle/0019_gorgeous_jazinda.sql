CREATE TABLE `capacity_pools` (
	`capability` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`round_robin` integer DEFAULT false NOT NULL,
	`models` text NOT NULL,
	`updated_at` integer NOT NULL
);
