CREATE TABLE `partner_apps` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_hint` text NOT NULL,
	`webhook_url` text,
	`event_secret` text NOT NULL,
	`daily_invites` integer NOT NULL,
	`revoked_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partner_apps_keyHash_unique` ON `partner_apps` (`key_hash`);--> statement-breakpoint
CREATE TABLE `partner_events` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`invite_id` text,
	`type` text NOT NULL,
	`body` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text NOT NULL,
	`last_error` text,
	`sent_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `partner_apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invite_id`) REFERENCES `partner_invites`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `partner_events_due` ON `partner_events` (`state`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `partner_events_app_created` ON `partner_events` (`app_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `partner_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`place_id` text NOT NULL,
	`ref` text,
	`business_id` text,
	`opened_at` text,
	`claimed_at` text,
	`ends_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `partner_apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partner_invites_codeHash_unique` ON `partner_invites` (`code_hash`);--> statement-breakpoint
CREATE INDEX `partner_invites_app_place` ON `partner_invites` (`app_id`,`place_id`);--> statement-breakpoint
CREATE INDEX `partner_invites_app_created` ON `partner_invites` (`app_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `partner_invites_business` ON `partner_invites` (`business_id`);