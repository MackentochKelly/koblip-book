CREATE TABLE `chat_connections` (
	`business_id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`workspace_name` text NOT NULL,
	`scopes` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`access_expires_at` text,
	`needs_reconnect` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
