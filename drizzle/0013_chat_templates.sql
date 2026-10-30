CREATE TABLE `chat_templates` (
	`business_id` text NOT NULL,
	`message` text NOT NULL,
	`language` text NOT NULL,
	`chat_template_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`business_id`, `message`, `language`),
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `chat_connections` ADD `waba_id` text;--> statement-breakpoint
ALTER TABLE `chat_connections` ADD `phone_number_id` text;