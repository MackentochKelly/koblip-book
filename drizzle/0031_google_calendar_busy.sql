CREATE TABLE `google_calendar_busy` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `google_calendar_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `google_calendar_busy_connection` ON `google_calendar_busy` (`connection_id`,`start_at`);--> statement-breakpoint
ALTER TABLE `google_calendar_connections` ADD `busy_team_member_id` text REFERENCES team_members(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `google_calendar_connections` ADD `busy_checked_at` text;