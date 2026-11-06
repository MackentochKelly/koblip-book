CREATE TABLE `pro_grants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`business_id` text NOT NULL,
	`stripe_subscription_id` text NOT NULL,
	`given_by` text,
	`given_at` text NOT NULL,
	`removed_by` text,
	`removed_at` text,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`given_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`removed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pro_grants_stripeSubscriptionId_unique` ON `pro_grants` (`stripe_subscription_id`);--> statement-breakpoint
CREATE INDEX `pro_grants_business_idx` ON `pro_grants` (`business_id`);