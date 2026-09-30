CREATE TABLE `usage_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`at` integer NOT NULL,
	`endpoint` text NOT NULL,
	`requested_model` text,
	`api_key_id` text,
	`stream` integer DEFAULT false NOT NULL,
	`status` text NOT NULL,
	`http_status` integer NOT NULL,
	`error_code` text,
	`attempts` integer NOT NULL,
	`final_provider` text,
	`final_model` text,
	`final_connection_id` text,
	`input_tokens` integer NOT NULL,
	`output_tokens` integer NOT NULL,
	`cache_read_tokens` integer NOT NULL,
	`cache_write_tokens` integer NOT NULL,
	`reasoning_tokens` integer NOT NULL,
	`cost` real,
	`unpriced` integer NOT NULL,
	`latency_ms` integer NOT NULL,
	`ttft_ms` integer
);
--> statement-breakpoint
CREATE INDEX `usage_requests_at` ON `usage_requests` (`at`,`id`);--> statement-breakpoint
CREATE INDEX `usage_requests_status_at` ON `usage_requests` (`status`,`at`);