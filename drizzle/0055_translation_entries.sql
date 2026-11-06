CREATE TABLE `translation_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`business_id` text,
	`module` text NOT NULL,
	`key` text NOT NULL,
	`language` text NOT NULL,
	`source_text` text NOT NULL,
	`source_hash` text NOT NULL,
	`text` text,
	`machine_text` text,
	`machine_source_hash` text,
	`status` text NOT NULL,
	`origin` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `translation_entries_scope_key_language_idx` ON `translation_entries` (`scope`,`key`,`language`);--> statement-breakpoint
CREATE INDEX `translation_entries_queue_idx` ON `translation_entries` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `translation_entries_business_idx` ON `translation_entries` (`business_id`,`language`);--> statement-breakpoint
CREATE INDEX `translation_entries_memory_idx` ON `translation_entries` (`language`,`source_hash`);--> statement-breakpoint
CREATE TABLE `translation_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_id` text,
	`scope` text NOT NULL,
	`business_id` text,
	`key` text NOT NULL,
	`language` text NOT NULL,
	`action` text NOT NULL,
	`source_text` text NOT NULL,
	`before` text,
	`after` text,
	`characters` integer DEFAULT 0 NOT NULL,
	`changed_by` text,
	`changed_at` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `translation_entries`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `translation_history_entry_idx` ON `translation_history` (`entry_id`);--> statement-breakpoint
CREATE INDEX `translation_history_usage_idx` ON `translation_history` (`business_id`,`changed_at`);