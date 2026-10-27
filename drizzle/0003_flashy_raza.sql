CREATE TABLE `team_member_services` (
	`business_id` text NOT NULL,
	`team_member_id` text NOT NULL,
	`service_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`team_member_id`, `service_id`),
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_member_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `team_member_services_business_idx` ON `team_member_services` (`business_id`);--> statement-breakpoint
CREATE INDEX `team_member_services_service_idx` ON `team_member_services` (`service_id`);--> statement-breakpoint
CREATE TABLE `translations` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`field` text NOT NULL,
	`language` text NOT NULL,
	`source_text` text NOT NULL,
	`text` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `translations_entity_field_language_idx` ON `translations` (`entity_id`,`field`,`language`);--> statement-breakpoint
CREATE INDEX `translations_business_idx` ON `translations` (`business_id`,`language`);--> statement-breakpoint
ALTER TABLE `bookings` ADD `source` text DEFAULT 'online' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `note` text;--> statement-breakpoint
ALTER TABLE `services` ADD `photo_url` text;