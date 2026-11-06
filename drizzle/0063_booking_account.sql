ALTER TABLE `bookings` ADD `customer_user_id` text REFERENCES user(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `bookings` ADD `claim_token_hash` text;--> statement-breakpoint
CREATE INDEX `bookings_customer_user_idx` ON `bookings` (`customer_user_id`,`start_at`);