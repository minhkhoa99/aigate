DROP INDEX `provider_nodes_prefix_unique`;--> statement-breakpoint
CREATE INDEX `provider_nodes_prefix_idx` ON `provider_nodes` (`prefix`,`created_at`);