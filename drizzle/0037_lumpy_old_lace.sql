CREATE TABLE `koblip_notification_texts` (
	`message` text NOT NULL,
	`language` text NOT NULL,
	`header` text NOT NULL,
	`body` text NOT NULL,
	`footer` text NOT NULL,
	`buttons` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`message`, `language`)
);
