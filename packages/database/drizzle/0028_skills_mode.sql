-- Hand-written in place of drizzle-kit's table rebuild: migrations run inside one transaction, where
-- PRAGMA foreign_keys=OFF has no effect, so DROP TABLE skills would cascade-delete every skill_index row.
ALTER TABLE `skills` ADD `mode` text DEFAULT 'auto' NOT NULL CONSTRAINT "skills_mode" CHECK(mode IN ('auto', 'always', 'off'));--> statement-breakpoint
UPDATE `skills` SET `mode` = 'off' WHERE `auto` = 0;
