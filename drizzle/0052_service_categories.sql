CREATE TABLE `service_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `service_categories_business_idx` ON `service_categories` (`business_id`,`position`);--> statement-breakpoint
ALTER TABLE `services` ADD `category_id` text REFERENCES service_categories(id) ON DELETE set null;--> statement-breakpoint
CREATE INDEX `services_category_idx` ON `services` (`category_id`);