CREATE TABLE `custom_models` (
	`provider` text NOT NULL,
	`model_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`provider`, `model_id`)
);
