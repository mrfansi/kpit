CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text,
  `user_email` text,
  `action` text NOT NULL,
  `entity` text NOT NULL,
  `entity_id` text,
  `detail` text,
  `created_at` integer NOT NULL
);
