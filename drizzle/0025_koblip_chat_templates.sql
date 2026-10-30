CREATE TABLE `koblip_chat_templates` (
	`message` text NOT NULL,
	`language` text NOT NULL,
	`chat_template_id` text NOT NULL,
	`status` text NOT NULL,
	`reason` text,
	`submitted` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`message`, `language`)
);
