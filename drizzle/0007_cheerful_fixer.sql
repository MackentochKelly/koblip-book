CREATE TABLE `assistant_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`owner_id` text,
	`tool` text NOT NULL,
	`summary` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `assistant_actions_business_idx` ON `assistant_actions` (`business_id`);