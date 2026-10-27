ALTER TABLE `businesses` DROP COLUMN `rating`;--> statement-breakpoint
ALTER TABLE `businesses` DROP COLUMN `review_count`;--> statement-breakpoint
ALTER TABLE `businesses` DROP COLUMN `latitude`;--> statement-breakpoint
ALTER TABLE `businesses` DROP COLUMN `longitude`;--> statement-breakpoint
ALTER TABLE `businesses` DROP COLUMN `maps_url`;--> statement-breakpoint
ALTER TABLE `businesses` ADD `details_confirmed_at` integer;