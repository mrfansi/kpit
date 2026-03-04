DROP TABLE IF EXISTS `timeline_task_dependencies`;
--> statement-breakpoint
DROP TABLE IF EXISTS `timeline_milestones`;
--> statement-breakpoint
DROP TABLE IF EXISTS `timeline_tasks`;
--> statement-breakpoint
DROP TABLE IF EXISTS `timeline_projects`;
--> statement-breakpoint
CREATE TABLE `timeline_projects` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `color` text DEFAULT '#6366f1' NOT NULL,
  `description` text,
  `start_date` text NOT NULL,
  `end_date` text NOT NULL,
  `progress` integer DEFAULT 0 NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
