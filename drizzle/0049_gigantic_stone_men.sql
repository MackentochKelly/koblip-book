CREATE TABLE `owner_voices` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`voice_id` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
