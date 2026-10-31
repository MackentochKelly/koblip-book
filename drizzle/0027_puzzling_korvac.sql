CREATE TABLE `team_member_hours` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`team_member_id` text NOT NULL,
	`weekday` integer NOT NULL,
	`opens_at` text NOT NULL,
	`closes_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_member_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `team_member_hours_member_idx` ON `team_member_hours` (`team_member_id`,`weekday`);