CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`business_id` text NOT NULL,
	`user_id` text,
	`author_name` text NOT NULL,
	`stars` integer NOT NULL,
	`comment` text,
	`hidden_at` text,
	`hidden_reason` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_bookingId_unique` ON `reviews` (`booking_id`);--> statement-breakpoint
CREATE INDEX `reviews_business` ON `reviews` (`business_id`,`created_at`);