CREATE TABLE `addon_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`prompt` text NOT NULL,
	`min_select` integer DEFAULT 0 NOT NULL,
	`max_select` integer,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `addon_groups_business_idx` ON `addon_groups` (`business_id`,`position`);--> statement-breakpoint
CREATE TABLE `addon_options` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`group_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price_minor` integer,
	`duration_minutes` integer DEFAULT 0 NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `addon_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `addon_options_group_idx` ON `addon_options` (`group_id`,`position`);--> statement-breakpoint
CREATE TABLE `booking_addons` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`booking_id` text NOT NULL,
	`option_id` text,
	`name` text NOT NULL,
	`price_minor` integer,
	`duration_minutes` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`option_id`) REFERENCES `addon_options`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `booking_addons_booking_idx` ON `booking_addons` (`booking_id`);--> statement-breakpoint
CREATE TABLE `service_addon_groups` (
	`business_id` text NOT NULL,
	`service_id` text NOT NULL,
	`group_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`service_id`, `group_id`),
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `addon_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `service_addon_groups_group_idx` ON `service_addon_groups` (`group_id`);