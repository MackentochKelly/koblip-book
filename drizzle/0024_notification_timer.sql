CREATE TABLE `notification_timer` (
	`id` text PRIMARY KEY NOT NULL,
	`last_run_at` text NOT NULL,
	`last_error` text
);
