CREATE TABLE `team_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`team_member_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_member_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_invites_tokenHash_unique` ON `team_invites` (`token_hash`);--> statement-breakpoint
CREATE INDEX `team_invites_member_idx` ON `team_invites` (`team_member_id`);--> statement-breakpoint
ALTER TABLE `team_members` ADD `about` text;--> statement-breakpoint
ALTER TABLE `team_members` ADD `languages` text;--> statement-breakpoint
ALTER TABLE `team_members` ADD `user_id` text REFERENCES user(id) ON DELETE set null;--> statement-breakpoint
CREATE UNIQUE INDEX `team_members_business_user_idx` ON `team_members` (`business_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `team_members_user_idx` ON `team_members` (`user_id`);