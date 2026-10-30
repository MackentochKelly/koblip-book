CREATE TABLE `koblip_chat_connection` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`workspace_name` text NOT NULL,
	`scopes` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`access_expires_at` text,
	`needs_reconnect` integer DEFAULT false NOT NULL,
	`waba_id` text,
	`phone_number_id` text,
	`connected_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`connected_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
