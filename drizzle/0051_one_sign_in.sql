DROP TABLE `customer_account`;--> statement-breakpoint
DROP TABLE `customer_session`;--> statement-breakpoint
DROP TABLE `customer_user`;--> statement-breakpoint
DROP TABLE `customer_verification`;--> statement-breakpoint
ALTER TABLE `user` ADD `phone_number` text;--> statement-breakpoint
ALTER TABLE `user` ADD `phone_number_verified` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `user_phone_number_unique` ON `user` (`phone_number`);