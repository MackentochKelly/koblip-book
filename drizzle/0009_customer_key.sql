ALTER TABLE `bookings` ADD `customer_key` text;--> statement-breakpoint
CREATE INDEX `bookings_customer_idx` ON `bookings` (`business_id`,`customer_key`,`start_at`);