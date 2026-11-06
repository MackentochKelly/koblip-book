CREATE TABLE `client_reminder_emails` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`moves` integer NOT NULL,
	`user_id` text,
	`state` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_reminder_emails_booking` ON `client_reminder_emails` (`booking_id`,`moves`);--> statement-breakpoint
CREATE INDEX `client_reminder_emails_created` ON `client_reminder_emails` (`created_at`);--> statement-breakpoint
ALTER TABLE `client_notification_settings` ADD `reminder_channel` text DEFAULT 'whatsapp' NOT NULL;