ALTER TABLE `settings` ADD `skills_selection` text DEFAULT 'hybrid' NOT NULL;--> statement-breakpoint
ALTER TABLE `usage_requests` ADD `skills` text;