CREATE TABLE `plan_feature_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`feature_key` text NOT NULL,
	`before` text,
	`after` text,
	`changed_by` text,
	`changed_at` text NOT NULL,
	FOREIGN KEY (`changed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `plan_feature_changes_changed_at_idx` ON `plan_feature_changes` (`changed_at`);--> statement-breakpoint
CREATE TABLE `plan_features` (
	`feature_key` text PRIMARY KEY NOT NULL,
	`plan` text NOT NULL,
	`updated_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
