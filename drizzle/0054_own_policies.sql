-- Own policies: kind becomes optional (null: the owner's own) and a title
-- column is added. The old table has no title, so the copy fills NULL.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_business_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`kind` text,
	`title` text,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_business_policies`("id", "business_id", "kind", "title", "body", "created_at", "updated_at") SELECT "id", "business_id", "kind", NULL, "body", "created_at", "updated_at" FROM `business_policies`;--> statement-breakpoint
DROP TABLE `business_policies`;--> statement-breakpoint
ALTER TABLE `__new_business_policies` RENAME TO `business_policies`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `business_policies_business_kind_idx` ON `business_policies` (`business_id`,`kind`);