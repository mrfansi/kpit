CREATE TABLE `domains` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`icon` text DEFAULT 'BarChart2' NOT NULL,
	`color` text DEFAULT '#6366f1' NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `domains_slug_unique` ON `domains` (`slug`);--> statement-breakpoint
CREATE TABLE `kpi_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kpi_id` integer NOT NULL,
	`value` real NOT NULL,
	`period_date` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`kpi_id`) REFERENCES `kpis`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `kpis` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`domain_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`unit` text DEFAULT '%' NOT NULL,
	`target` real NOT NULL,
	`threshold_green` real NOT NULL,
	`threshold_yellow` real NOT NULL,
	`refresh_type` text DEFAULT 'periodic' NOT NULL,
	`period` text DEFAULT 'monthly' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE cascade
);
