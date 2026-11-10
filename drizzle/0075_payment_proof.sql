ALTER TABLE `bookings` ADD `payment_proof` text;--> statement-breakpoint
ALTER TABLE `businesses` ADD `payment_proof` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `businesses` ADD `payment_proof_team` integer DEFAULT true NOT NULL;