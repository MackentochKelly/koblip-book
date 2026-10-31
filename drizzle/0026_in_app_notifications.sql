CREATE TABLE `in_app_notification_settings` (
	`business_id` text PRIMARY KEY NOT NULL,
	`turned_off` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `in_app_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	`link` text NOT NULL,
	`read_at` text,
	`dedupe_key` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `in_app_notifications_business` ON `in_app_notifications` (`business_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `in_app_notifications_unread` ON `in_app_notifications` (`business_id`,`read_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `in_app_notifications_once` ON `in_app_notifications` (`business_id`,`dedupe_key`);