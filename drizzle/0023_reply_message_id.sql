ALTER TABLE `notification_sends` ADD `chat_message_id` text;--> statement-breakpoint
CREATE INDEX `notification_sends_message` ON `notification_sends` (`chat_message_id`);