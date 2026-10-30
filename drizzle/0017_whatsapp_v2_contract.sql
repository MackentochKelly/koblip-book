ALTER TABLE `notification_sends` ADD `sender` text DEFAULT 'own' NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_sends` ADD `reply_action` text;--> statement-breakpoint
ALTER TABLE `notification_sends` ADD `replied_at` text;--> statement-breakpoint
ALTER TABLE `notification_settings` ADD `free_text_in_window` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_settings` ADD `cant_come` text DEFAULT 'alertOnly' NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_settings` ADD `thank_you_reply` integer DEFAULT true NOT NULL;