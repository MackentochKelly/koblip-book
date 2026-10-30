DROP INDEX `notification_sends_once`;--> statement-breakpoint
ALTER TABLE `notification_sends` DROP COLUMN `visit_at`;--> statement-breakpoint
ALTER TABLE `notification_sends` ADD `moves` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `moves` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `notification_sends_once` ON `notification_sends` (`booking_id`,`message`,`reminder_minutes`,`moves`);
