INSERT INTO `payment_methods` (`id`, `business_id`, `type`, `name`, `details`, `position`, `created_at`, `updated_at`)
SELECT lower(hex(randomblob(16))), b.`id`, 'bank_transfer', 'Sample Bank', 'Account holder: Sample Name' || char(10) || 'Account number: 0000 0000 0000',
  (SELECT count(*) FROM `payment_methods` m WHERE m.`business_id` = b.`id`),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `businesses` b
WHERE NOT EXISTS (SELECT 1 FROM `payment_methods` m WHERE m.`business_id` = b.`id` AND m.`type` = 'bank_transfer')
  AND NOT EXISTS (SELECT 1 FROM json_each(b.`removed_payment_types`) WHERE value = 'bank_transfer');
--> statement-breakpoint
INSERT INTO `payment_methods` (`id`, `business_id`, `type`, `name`, `details`, `position`, `created_at`, `updated_at`)
SELECT lower(hex(randomblob(16))), b.`id`, 'zelle', 'Zelle', 'sample@example.com',
  (SELECT count(*) FROM `payment_methods` m WHERE m.`business_id` = b.`id`),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `businesses` b
WHERE NOT EXISTS (SELECT 1 FROM `payment_methods` m WHERE m.`business_id` = b.`id` AND m.`type` = 'zelle')
  AND NOT EXISTS (SELECT 1 FROM json_each(b.`removed_payment_types`) WHERE value = 'zelle');
--> statement-breakpoint
INSERT INTO `payment_methods` (`id`, `business_id`, `type`, `name`, `details`, `position`, `created_at`, `updated_at`)
SELECT lower(hex(randomblob(16))), b.`id`, 'cash_app', 'Cash App', '$sample-cashtag',
  (SELECT count(*) FROM `payment_methods` m WHERE m.`business_id` = b.`id`),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `businesses` b
WHERE NOT EXISTS (SELECT 1 FROM `payment_methods` m WHERE m.`business_id` = b.`id` AND m.`type` = 'cash_app')
  AND NOT EXISTS (SELECT 1 FROM json_each(b.`removed_payment_types`) WHERE value = 'cash_app');
