CREATE TABLE `notification_settings` (
	`business_id` text PRIMARY KEY NOT NULL,
	`owner_phone` text,
	`reminders` text NOT NULL,
	`quiet_start` text NOT NULL,
	`quiet_end` text NOT NULL,
	`turned_off` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notification_texts` (
	`business_id` text NOT NULL,
	`message` text NOT NULL,
	`language` text NOT NULL,
	`header` text NOT NULL,
	`body` text NOT NULL,
	`footer` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`business_id`, `message`, `language`),
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
