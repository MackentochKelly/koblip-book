CREATE TABLE `booking_holds` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`booking_id` text NOT NULL,
	`input` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`team_member_id` text,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`customer_user_id` text,
	`reward_phone` text,
	`claim_token_hash` text NOT NULL,
	`stripe_session_id` text,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_member_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_holds_session_idx` ON `booking_holds` (`stripe_session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `booking_holds_booking_idx` ON `booking_holds` (`booking_id`);--> statement-breakpoint
CREATE INDEX `booking_holds_business_idx` ON `booking_holds` (`business_id`,`start_at`);--> statement-breakpoint
CREATE INDEX `booking_holds_expiry_idx` ON `booking_holds` (`expires_at`);--> statement-breakpoint
CREATE TABLE `online_payment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`kind` text NOT NULL,
	`business_id` text,
	`booking_id` text,
	`stripe_account_id` text,
	`amount_minor` integer,
	`currency` text,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `online_payment_events_key_idx` ON `online_payment_events` (`key`);--> statement-breakpoint
CREATE INDEX `online_payment_events_business_idx` ON `online_payment_events` (`business_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `online_payment_events_booking_idx` ON `online_payment_events` (`booking_id`);--> statement-breakpoint
CREATE INDEX `online_payment_events_time_idx` ON `online_payment_events` (`created_at`);--> statement-breakpoint
ALTER TABLE `bookings` ADD `paid_online_minor` integer;--> statement-breakpoint
ALTER TABLE `bookings` ADD `stripe_session_id` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `stripe_payment_id` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `refunded_minor` integer;--> statement-breakpoint
ALTER TABLE `bookings` ADD `refunded_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_stripe_session_idx` ON `bookings` (`stripe_session_id`);--> statement-breakpoint
CREATE INDEX `bookings_stripe_payment_idx` ON `bookings` (`stripe_payment_id`);--> statement-breakpoint
ALTER TABLE `businesses` ADD `stripe_account_id` text;--> statement-breakpoint
ALTER TABLE `businesses` ADD `stripe_charges_on` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `businesses` ADD `stripe_refused_country` text;--> statement-breakpoint
ALTER TABLE `businesses` ADD `online_pay` text DEFAULT 'off' NOT NULL;--> statement-breakpoint
ALTER TABLE `businesses` ADD `deposit_type` text;--> statement-breakpoint
ALTER TABLE `businesses` ADD `deposit_value` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `businesses_stripe_account_idx` ON `businesses` (`stripe_account_id`);