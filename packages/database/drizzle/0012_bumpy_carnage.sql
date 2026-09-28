CREATE TABLE `provider_thinking` (
	`provider` text PRIMARY KEY NOT NULL,
	`level` text NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "provider_thinking_level" CHECK(level IN ('none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'))
);
