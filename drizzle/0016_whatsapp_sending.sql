CREATE TABLE `notification_sends` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`booking_id` text NOT NULL,
	`message` text NOT NULL,
	`reminder_minutes` integer DEFAULT 0 NOT NULL,
	`due_at` text NOT NULL,
	`state` text NOT NULL,
	`reason` text,
	`via` text,
	`chat_record_id` text,
	`delivery` text,
	`sent_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_sends_once` ON `notification_sends` (`booking_id`,`message`,`reminder_minutes`);--> statement-breakpoint
CREATE INDEX `notification_sends_due` ON `notification_sends` (`state`,`due_at`);--> statement-breakpoint
CREATE INDEX `notification_sends_business` ON `notification_sends` (`business_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `notification_sends_record` ON `notification_sends` (`chat_record_id`);--> statement-breakpoint
ALTER TABLE `bookings` ADD `whatsapp_opt_in` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `language` text;--> statement-breakpoint
ALTER TABLE `notification_settings` ADD `owner_language` text DEFAULT 'en' NOT NULL;