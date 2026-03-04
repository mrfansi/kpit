CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`user_email` text,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`detail` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'admin' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
ALTER TABLE `kpis` ADD `direction` text DEFAULT 'higher_better' NOT NULL;--> statement-breakpoint
ALTER TABLE `kpis` ADD `is_pinned` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `kpis` ADD `sort_order` integer DEFAULT 0 NOT NULL;