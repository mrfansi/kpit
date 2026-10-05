CREATE TABLE `monthly_reports` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `domain_id` integer NOT NULL,
  `period` text NOT NULL,
  `content` text NOT NULL,
  `revision` integer DEFAULT 1 NOT NULL,
  `created_by` text NOT NULL,
  `updated_by` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_monthly_reports_domain_period` ON `monthly_reports` (`domain_id`,`period`);
--> statement-breakpoint
CREATE INDEX `idx_monthly_reports_period` ON `monthly_reports` (`period`);
--> statement-breakpoint
CREATE TABLE `monthly_report_revisions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `report_id` integer NOT NULL,
  `revision` integer NOT NULL,
  `content` text NOT NULL,
  `author_id` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`report_id`) REFERENCES `monthly_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_monthly_report_revisions_report_revision` ON `monthly_report_revisions` (`report_id`,`revision`);
