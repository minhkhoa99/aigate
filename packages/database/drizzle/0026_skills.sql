CREATE TABLE `skills` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `description` text DEFAULT '' NOT NULL,
  `source` text NOT NULL,
  `url` text,
  `content` text,
  `enabled` integer DEFAULT true NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  CONSTRAINT "skills_source" CHECK(source IN ('link', 'file')),
  CONSTRAINT "skills_source_shape" CHECK((source = 'link' AND url IS NOT NULL AND content IS NULL) OR (source = 'file' AND content IS NOT NULL AND url IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skills_name_nocase` ON `skills` (lower("name"));--> statement-breakpoint
CREATE INDEX `skills_created_at` ON `skills` (`created_at`);
