ALTER TABLE `businesses` ADD `is_demo` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `businesses_demo_idx` ON `businesses` (`is_demo`,`created_at`);--> statement-breakpoint
ALTER TABLE `user` ADD `is_anonymous` integer DEFAULT false;