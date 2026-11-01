CREATE TABLE `business_policy_points` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`icon` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `business_policy_points_business_idx` ON `business_policy_points` (`business_id`,`position`);--> statement-breakpoint
ALTER TABLE `bookings` ADD `policies_accepted_at` text;