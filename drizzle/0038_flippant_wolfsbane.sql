ALTER TABLE `koblip_chat_templates` ADD `version` integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `koblip_chat_templates` ADD `live` text;--> statement-breakpoint
ALTER TABLE `koblip_chat_templates` ADD `retired` text;