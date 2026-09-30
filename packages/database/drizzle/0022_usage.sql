CREATE TABLE `pricing_overrides` (
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`input` real,
	`output` real,
	`cached` real,
	`reasoning` real,
	`cache_creation` real,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`provider`, `model`)
);
--> statement-breakpoint
CREATE TABLE `usage_daily` (
	`day` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`connection_id` text DEFAULT '' NOT NULL,
	`api_key_id` text DEFAULT '' NOT NULL,
	`endpoint` text NOT NULL,
	`requests` integer NOT NULL,
	`errors` integer NOT NULL,
	`input_tokens` integer NOT NULL,
	`output_tokens` integer NOT NULL,
	`cache_read_tokens` integer NOT NULL,
	`cache_write_tokens` integer NOT NULL,
	`reasoning_tokens` integer NOT NULL,
	`cost` real NOT NULL,
	`unpriced` integer NOT NULL,
	PRIMARY KEY(`day`, `provider`, `model`, `connection_id`, `api_key_id`, `endpoint`)
);
--> statement-breakpoint
CREATE TABLE `usage_events` (
	`id` text PRIMARY KEY NOT NULL,
	`at` integer NOT NULL,
	`request_id` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`connection_id` text,
	`api_key_id` text,
	`endpoint` text NOT NULL,
	`status` text NOT NULL,
	`error_code` text,
	`input_tokens` integer NOT NULL,
	`output_tokens` integer NOT NULL,
	`cache_read_tokens` integer NOT NULL,
	`cache_write_tokens` integer NOT NULL,
	`reasoning_tokens` integer NOT NULL,
	`estimated` integer DEFAULT false NOT NULL,
	`cost` real,
	`latency_ms` integer NOT NULL,
	`ttft_ms` integer
);
--> statement-breakpoint
CREATE INDEX `usage_events_at` ON `usage_events` (`at`);--> statement-breakpoint
CREATE INDEX `usage_events_request` ON `usage_events` (`request_id`);