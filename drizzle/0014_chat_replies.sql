CREATE TABLE `chat_replies` (
	`workspace_id` text NOT NULL,
	`phone_number_id` text NOT NULL,
	`customer_phone` text NOT NULL,
	`last_reply_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`workspace_id`, `phone_number_id`, `customer_phone`)
);
