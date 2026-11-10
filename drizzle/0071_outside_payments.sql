CREATE TABLE `payment_methods` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`details` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payment_methods_business_idx` ON `payment_methods` (`business_id`,`position`);--> statement-breakpoint
ALTER TABLE `bookings` ADD `payment_choice` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `payment_method` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `payment_status` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `payment_reference` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `payment_reported_at` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `payment_paid_at` text;--> statement-breakpoint
ALTER TABLE `businesses` ADD `pay_later` integer DEFAULT true NOT NULL;