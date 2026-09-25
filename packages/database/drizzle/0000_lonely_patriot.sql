CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`require_login` integer DEFAULT true NOT NULL,
	`require_api_key` integer DEFAULT true NOT NULL,
	CONSTRAINT "settings_single_row" CHECK("settings"."id" = 1)
);
