CREATE TABLE `google_calendar_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`team_member_id` text,
	`google_email` text NOT NULL,
	`scopes` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`access_expires_at` text,
	`needs_reconnect` integer DEFAULT false NOT NULL,
	`calendar_id` text,
	`last_sync_at` text,
	`last_error` text,
	`connected_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_member_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connected_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `google_calendar_connections_business` ON `google_calendar_connections` (`business_id`) WHERE "google_calendar_connections"."team_member_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `google_calendar_connections_member` ON `google_calendar_connections` (`team_member_id`) WHERE "google_calendar_connections"."team_member_id" is not null;--> statement-breakpoint
CREATE TABLE `google_calendar_events` (
	`connection_id` text NOT NULL,
	`booking_id` text NOT NULL,
	`event_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`synced_at` text NOT NULL,
	PRIMARY KEY(`connection_id`, `booking_id`),
	FOREIGN KEY (`connection_id`) REFERENCES `google_calendar_connections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade
);
