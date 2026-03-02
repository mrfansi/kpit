CREATE TABLE `kpi_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kpi_id` integer NOT NULL,
	`period_date` text NOT NULL,
	`content` text NOT NULL,
	`author` text DEFAULT 'Admin' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`kpi_id`) REFERENCES `kpis`(`id`) ON UPDATE no action ON DELETE cascade
);
