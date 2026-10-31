CREATE TABLE `google_calendar_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`calendar_id` text NOT NULL,
	`resource_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `google_calendar_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `google_calendar_channels_connection` ON `google_calendar_channels` (`connection_id`,`expires_at`);