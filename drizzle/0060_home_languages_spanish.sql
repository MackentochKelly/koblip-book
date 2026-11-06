-- The home names all four languages (docs/plans/translations.md, G9): the
-- FAQ's question moves from `spanish` to `languages` in every language, and
-- Spanish follows the four English lines that changed. Edited, logged.
UPDATE `translation_entries` SET `key` = replace(`key`, 'public.home.faq.items.spanish.', 'public.home.faq.items.languages.'), `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `scope` = 'interface' AND `business_id` IS NULL AND `key` IN ('public.home.faq.items.spanish.q', 'public.home.faq.items.spanish.a');
--> statement-breakpoint
INSERT INTO `translation_history` (`entry_id`, `scope`, `business_id`, `key`, `language`, `action`, `source_text`, `before`, `after`, `characters`, `changed_at`)
SELECT `id`, 'interface', NULL, `key`, 'es', 'edited', 'Does it work in other languages?', `text`, '¿Funciona en otros idiomas?', 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `translation_entries` WHERE `scope` = 'interface' AND `business_id` IS NULL AND `language` = 'es' AND `key` = 'public.home.faq.items.languages.q';
--> statement-breakpoint
UPDATE `translation_entries` SET `source_text` = 'Does it work in other languages?', `source_hash` = '8e2736f6126657071c44c2eec9dc244d79fe72b6fd0df0dbbcc5a82d6da8ca68', `text` = '¿Funciona en otros idiomas?', `status` = 'edited', `origin` = 'manual', `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `scope` = 'interface' AND `business_id` IS NULL AND `language` = 'es' AND `key` = 'public.home.faq.items.languages.q';
--> statement-breakpoint
INSERT INTO `translation_history` (`entry_id`, `scope`, `business_id`, `key`, `language`, `action`, `source_text`, `before`, `after`, `characters`, `changed_at`)
SELECT `id`, 'interface', NULL, `key`, 'es', 'edited', 'Yes. Your page shows in your client''s language: English, Spanish, Portuguese or French.', `text`, 'Sí. Tu página se muestra en el idioma de tu cliente: inglés, español, portugués o francés.', 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `translation_entries` WHERE `scope` = 'interface' AND `business_id` IS NULL AND `language` = 'es' AND `key` = 'public.home.faq.items.languages.a';
--> statement-breakpoint
UPDATE `translation_entries` SET `source_text` = 'Yes. Your page shows in your client''s language: English, Spanish, Portuguese or French.', `source_hash` = '74e81c97d899a4d2f34e6bfdebbed4439b49f1e569fe91e7668402ba8087c04f', `text` = 'Sí. Tu página se muestra en el idioma de tu cliente: inglés, español, portugués o francés.', `status` = 'edited', `origin` = 'manual', `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `scope` = 'interface' AND `business_id` IS NULL AND `language` = 'es' AND `key` = 'public.home.faq.items.languages.a';
--> statement-breakpoint
INSERT INTO `translation_history` (`entry_id`, `scope`, `business_id`, `key`, `language`, `action`, `source_text`, `before`, `after`, `characters`, `changed_at`)
SELECT `id`, 'interface', NULL, `key`, 'es', 'edited', 'English, Spanish, Portuguese and French', `text`, 'Inglés, español, portugués y francés', 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `translation_entries` WHERE `scope` = 'interface' AND `business_id` IS NULL AND `language` = 'es' AND `key` = 'public.home.pricing.free.features.languages';
--> statement-breakpoint
UPDATE `translation_entries` SET `source_text` = 'English, Spanish, Portuguese and French', `source_hash` = 'c2e869bec60d0017c9c1fa285b00eee9e857d66ae6702545d5a4b319f4fcbcaf', `text` = 'Inglés, español, portugués y francés', `status` = 'edited', `origin` = 'manual', `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `scope` = 'interface' AND `business_id` IS NULL AND `language` = 'es' AND `key` = 'public.home.pricing.free.features.languages';
--> statement-breakpoint
INSERT INTO `translation_history` (`entry_id`, `scope`, `business_id`, `key`, `language`, `action`, `source_text`, `before`, `after`, `characters`, `changed_at`)
SELECT `id`, 'interface', NULL, `key`, 'es', 'edited', 'Your page shows in English, Spanish, Portuguese or French.', `text`, 'Tu página se ve en inglés, español, portugués o francés.', 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `translation_entries` WHERE `scope` = 'interface' AND `business_id` IS NULL AND `language` = 'es' AND `key` = 'public.home.features.languageText';
--> statement-breakpoint
UPDATE `translation_entries` SET `source_text` = 'Your page shows in English, Spanish, Portuguese or French.', `source_hash` = 'e8650996bec8b5d1a33e6948eb2facbad7fd4326fa638d9658fb1bd89a1ca039', `text` = 'Tu página se ve en inglés, español, portugués o francés.', `status` = 'edited', `origin` = 'manual', `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `scope` = 'interface' AND `business_id` IS NULL AND `language` = 'es' AND `key` = 'public.home.features.languageText';
