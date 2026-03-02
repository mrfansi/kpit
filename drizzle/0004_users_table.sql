CREATE TABLE IF NOT EXISTS `users` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL UNIQUE,
  `name` text NOT NULL,
  `password_hash` text NOT NULL,
  `role` text NOT NULL DEFAULT 'admin',
  `created_at` integer NOT NULL
);
