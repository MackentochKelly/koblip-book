CREATE TABLE `email_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`business_id` text,
	`reason` text NOT NULL,
	`send_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`send_id`) REFERENCES `email_sends`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_blocks_email` ON `email_blocks` (`email`,`business_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `email_blocks_everywhere` ON `email_blocks` (`email`) WHERE "email_blocks"."business_id" is null;--> statement-breakpoint
CREATE INDEX `email_blocks_created` ON `email_blocks` (`created_at`);--> statement-breakpoint
CREATE TABLE `email_sends` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`email` text NOT NULL,
	`user_id` text,
	`business_id` text,
	`booking_id` text,
	`reminder_minutes` integer DEFAULT 0 NOT NULL,
	`moves` integer DEFAULT 0 NOT NULL,
	`state` text NOT NULL,
	`reason` text,
	`language` text,
	`message_id` text,
	`sent_at` text,
	`delivery` text,
	`delivery_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_sends_booking` ON `email_sends` (`booking_id`,`kind`,`reminder_minutes`,`moves`);--> statement-breakpoint
CREATE INDEX `email_sends_message` ON `email_sends` (`message_id`);--> statement-breakpoint
CREATE INDEX `email_sends_created` ON `email_sends` (`created_at`);--> statement-breakpoint
CREATE INDEX `email_sends_email` ON `email_sends` (`email`);--> statement-breakpoint
-- Every reminder email sent so far moves into the one email log (EM-D4).
INSERT INTO `email_sends` (`id`, `kind`, `email`, `user_id`, `business_id`, `booking_id`, `reminder_minutes`, `moves`, `state`, `sent_at`, `created_at`, `updated_at`)
SELECT c.`id`, 'clientReminder', lower(coalesce(u.`email`, '')), c.`user_id`, b.`business_id`, c.`booking_id`, 0, c.`moves`, c.`state`, CASE WHEN c.`state` = 'sent' THEN c.`updated_at` END, c.`created_at`, c.`updated_at`
FROM `client_reminder_emails` c
JOIN `bookings` b ON b.`id` = c.`booking_id`
LEFT JOIN `user` u ON u.`id` = c.`user_id`;
