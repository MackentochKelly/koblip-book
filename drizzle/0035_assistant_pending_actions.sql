CREATE TABLE `assistant_pending_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`args` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `assistant_pending_actions_owner_idx` ON `assistant_pending_actions` (`owner_id`);--> statement-breakpoint
CREATE INDEX `assistant_pending_actions_created_idx` ON `assistant_pending_actions` (`created_at`);