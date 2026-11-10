CREATE TABLE `reward_events` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`customer_key` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`booking_id` text,
	`actor` text DEFAULT 'system' NOT NULL,
	`actor_user_id` text,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rule_id`) REFERENCES `reward_rules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `reward_events_customer_idx` ON `reward_events` (`rule_id`,`customer_key`);--> statement-breakpoint
CREATE INDEX `reward_events_booking_idx` ON `reward_events` (`booking_id`);--> statement-breakpoint
CREATE INDEX `reward_events_business_idx` ON `reward_events` (`business_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `reward_rule_services` (
	`business_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`service_id` text NOT NULL,
	`role` text NOT NULL,
	PRIMARY KEY(`rule_id`, `role`, `service_id`),
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rule_id`) REFERENCES `reward_rules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reward_rule_services_service_idx` ON `reward_rule_services` (`service_id`);--> statement-breakpoint
CREATE TABLE `reward_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`earn_type` text NOT NULL,
	`earn_min_price_minor` integer,
	`goal` integer NOT NULL,
	`reward_type` text NOT NULL,
	`reward_value` integer,
	`reward_count` integer DEFAULT 1 NOT NULL,
	`max_discount_minor` integer,
	`expires_days` integer,
	`starts_at` text NOT NULL,
	`ends_at` text,
	`max_per_customer` integer,
	`paid_only` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reward_rules_business_idx` ON `reward_rules` (`business_id`,`position`);--> statement-breakpoint
CREATE TABLE `rewards` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`customer_key` text NOT NULL,
	`reward` text NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`event_id` text,
	`earned_at` text NOT NULL,
	`expires_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rule_id`) REFERENCES `reward_rules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `reward_events`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `rewards_customer_idx` ON `rewards` (`business_id`,`customer_key`,`status`);--> statement-breakpoint
CREATE INDEX `rewards_rule_idx` ON `rewards` (`rule_id`);--> statement-breakpoint
CREATE INDEX `rewards_expiry_idx` ON `rewards` (`status`,`expires_at`);--> statement-breakpoint
ALTER TABLE `bookings` ADD `reward_id` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `reward_discount_minor` integer;--> statement-breakpoint
ALTER TABLE `bookings` ADD `rewards_counted_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_reward_idx` ON `bookings` (`reward_id`);--> statement-breakpoint
CREATE INDEX `bookings_rewards_count_idx` ON `bookings` (`rewards_counted_at`,`end_at`);