CREATE TABLE `kpi_targets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kpi_id` integer NOT NULL,
	`period_date` text NOT NULL,
	`target` real NOT NULL,
	`threshold_green` real NOT NULL,
	`threshold_yellow` real NOT NULL,
	FOREIGN KEY (`kpi_id`) REFERENCES `kpis`(`id`) ON UPDATE no action ON DELETE cascade
);
