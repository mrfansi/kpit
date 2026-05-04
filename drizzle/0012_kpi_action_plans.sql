CREATE TABLE `kpi_action_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kpi_id` integer NOT NULL REFERENCES `kpis`(`id`) ON DELETE CASCADE,
	`title` text NOT NULL,
	`description` text,
	`owner` text NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

CREATE INDEX `idx_kpi_action_plans_kpi_id` ON `kpi_action_plans` (`kpi_id`);
CREATE INDEX `idx_kpi_action_plans_status_due` ON `kpi_action_plans` (`status`, `due_date`);
