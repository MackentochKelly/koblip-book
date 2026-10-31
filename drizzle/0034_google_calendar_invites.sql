CREATE TABLE `google_calendar_invites` (
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
CREATE UNIQUE INDEX `google_calendar_invites_tokenHash_unique` ON `google_calendar_invites` (`token_hash`);--> statement-breakpoint
CREATE INDEX `google_calendar_invites_member` ON `google_calendar_invites` (`team_member_id`);