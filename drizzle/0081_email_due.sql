ALTER TABLE `email_sends` ADD `due_at` text;--> statement-breakpoint
CREATE INDEX `email_sends_due` ON `email_sends` (`state`,`due_at`);