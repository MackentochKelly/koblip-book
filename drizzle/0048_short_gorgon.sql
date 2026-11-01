ALTER TABLE `businesses` ADD `setup_finished_at` integer;
--> statement-breakpoint
UPDATE `businesses` SET `setup_finished_at` = cast(unixepoch('subsecond') * 1000 as integer)
WHERE `is_demo` = 1 OR (`owner_id` IS NOT NULL AND (
  EXISTS (SELECT 1 FROM `services` WHERE `business_id` = `businesses`.`id`)
  OR EXISTS (SELECT 1 FROM `team_members` WHERE `business_id` = `businesses`.`id`)
));
