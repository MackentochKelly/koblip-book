DROP INDEX `notification_sends_once`;--> statement-breakpoint
-- SQLite cannot add a NOT NULL column without a default; every row gets its
-- booking's start right after, and Book always sets visit_at itself.
ALTER TABLE `notification_sends` ADD `visit_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `notification_sends` SET `visit_at` = (SELECT `start_at` FROM `bookings` WHERE `bookings`.`id` = `notification_sends`.`booking_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `notification_sends_once` ON `notification_sends` (`booking_id`,`message`,`reminder_minutes`,`visit_at`);
