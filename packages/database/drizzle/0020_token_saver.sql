ALTER TABLE `settings` ADD `token_saver_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `rtk_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `headroom_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `headroom_url` text DEFAULT 'http://127.0.0.1:8787' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `headroom_timeout_ms` integer DEFAULT 3000 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `caveman_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `caveman_level` text DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `ponytail_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `ponytail_level` text DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `pxpipe_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `pxpipe_min_chars` integer DEFAULT 25000 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `pxpipe_timeout_ms` integer DEFAULT 15000 NOT NULL;