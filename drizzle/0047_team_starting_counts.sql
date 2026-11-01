ALTER TABLE `team_members` ADD `past_appointments` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `team_members` ADD `past_clients` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Existing team members get random starting numbers (TEAM_RULES.startingCounts: 470-1950, clients never more than appointments).
UPDATE `team_members` SET `past_appointments` = 470 + abs(random()) % 1481;--> statement-breakpoint
UPDATE `team_members` SET `past_clients` = 470 + abs(random()) % (`past_appointments` - 470 + 1);
