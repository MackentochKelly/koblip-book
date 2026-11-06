-- Meta's earlier translations move into translation_entries as they are
-- (docs/plans/translations.md, G3): still shown while made from the current
-- English; Google makes them again later (G7). The fingerprint is the app's
-- own (lib/translations/markup.ts sourceHash): SHA3-256 of the English.
INSERT INTO `translation_entries` (`id`, `scope`, `business_id`, `module`, `key`, `language`, `source_text`, `source_hash`, `text`, `status`, `origin`, `attempts`, `created_at`, `updated_at`)
SELECT `id`, 'business', `business_id`, `field`, `entity_id` || ':' || `field`, `language`, `source_text`, lower(hex(sha3(`source_text`))), `text`, 'automatic', 'meta', 0, `created_at`, `updated_at`
FROM `translations`
WHERE trim(`source_text`) <> '' AND trim(`text`) <> ''
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO `translation_history` (`entry_id`, `scope`, `business_id`, `key`, `language`, `action`, `source_text`, `after`, `characters`, `changed_at`)
SELECT `id`, 'business', `business_id`, `key`, `language`, 'imported', `source_text`, `text`, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `translation_entries`
WHERE `origin` = 'meta';--> statement-breakpoint
DROP TABLE `translations`;
