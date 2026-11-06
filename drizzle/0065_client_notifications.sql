CREATE TABLE `client_notification_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`turned_off` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `in_app_notifications` ADD `audience` text DEFAULT 'owner' NOT NULL;--> statement-breakpoint
ALTER TABLE `in_app_notifications` ADD `booking_id` text REFERENCES bookings(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `in_app_notifications_booking` ON `in_app_notifications` (`booking_id`);