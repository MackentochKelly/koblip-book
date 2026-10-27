PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`service_id` text,
	`team_member_id` text,
	`service_name` text NOT NULL,
	`team_member_name` text,
	`duration_minutes` integer NOT NULL,
	`price_minor` integer,
	`currency` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_phone` text,
	`source` text DEFAULT 'online' NOT NULL,
	`note` text,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`team_member_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_bookings`("id", "business_id", "service_id", "team_member_id", "service_name", "team_member_name", "duration_minutes", "price_minor", "currency", "start_at", "end_at", "customer_name", "customer_phone", "source", "note", "status", "created_at", "updated_at") SELECT "id", "business_id", "service_id", "team_member_id", "service_name", "team_member_name", "duration_minutes", "price_minor", "currency", "start_at", "end_at", "customer_name", "customer_phone", "source", "note", "status", "created_at", "updated_at" FROM `bookings`;--> statement-breakpoint
DROP TABLE `bookings`;--> statement-breakpoint
ALTER TABLE `__new_bookings` RENAME TO `bookings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `bookings_business_idx` ON `bookings` (`business_id`,`start_at`);