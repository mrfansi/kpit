CREATE TABLE `timeline_project_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL REFERENCES `timeline_projects`(`id`) ON DELETE CASCADE,
	`content` text NOT NULL,
	`progress_before` integer,
	`progress_after` integer,
	`author` text DEFAULT 'Admin' NOT NULL,
	`created_at` integer NOT NULL
);

CREATE INDEX `idx_timeline_project_logs_project_id` ON `timeline_project_logs` (`project_id`);
