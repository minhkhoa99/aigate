ALTER TABLE `provider_nodes` ADD `custom_headers_sealed` text;--> statement-breakpoint
ALTER TABLE `provider_nodes` ADD `retry_stream_errors` integer DEFAULT false NOT NULL;