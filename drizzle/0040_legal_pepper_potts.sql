CREATE TABLE `automation_events` (
	`business_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`phone_number_id` text NOT NULL,
	`event_id` text NOT NULL,
	`occurred_at` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`business_id`, `workspace_id`, `event_id`),
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `automation_events_business` ON `automation_events` (`business_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `automation_pauses` (
	`business_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`phone_number_id` text NOT NULL,
	`customer_phone` text NOT NULL,
	`until` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`business_id`, `workspace_id`, `phone_number_id`, `customer_phone`),
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `automation_pauses_until` ON `automation_pauses` (`until`);--> statement-breakpoint
CREATE TABLE `automation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`automation_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`phone_number_id` text NOT NULL,
	`event_id` text,
	`customer_phone` text NOT NULL,
	`customer_name` text,
	`language` text NOT NULL,
	`step` text NOT NULL,
	`state` text NOT NULL,
	`reason` text,
	`chat_record_id` text,
	`chat_message_id` text,
	`at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`,`automation_id`) REFERENCES `automations`(`business_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `automation_runs_business_at` ON `automation_runs` (`business_id`,`at`,`id`);--> statement-breakpoint
CREATE INDEX `automation_runs_automation_at` ON `automation_runs` (`business_id`,`automation_id`,`at`,`id`);--> statement-breakpoint
CREATE INDEX `automation_runs_customer` ON `automation_runs` (`business_id`,`workspace_id`,`phone_number_id`,`customer_phone`,`at`);--> statement-breakpoint
CREATE INDEX `automation_runs_record` ON `automation_runs` (`workspace_id`,`chat_record_id`);--> statement-breakpoint
CREATE TABLE `automations` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`key` text NOT NULL,
	`trigger` text NOT NULL,
	`on` integer DEFAULT false NOT NULL,
	`wording` text NOT NULL,
	`buttons` text NOT NULL,
	`is_default` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `automations_business_key` ON `automations` (`business_id`,`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `automations_business_id` ON `automations` (`business_id`,`id`);