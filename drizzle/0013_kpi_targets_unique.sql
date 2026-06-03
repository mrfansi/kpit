-- Enforce uniqueness on kpi_targets (kpi_id, period_date).
-- Removes any pre-existing duplicate rows first (keeping the lowest id),
-- then creates the unique index that upsertTarget/importTargetRows rely on.
DELETE FROM kpi_targets
WHERE id NOT IN (
  SELECT MIN(id) FROM kpi_targets GROUP BY kpi_id, period_date
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uq_kpi_targets_kpi_period ON kpi_targets (kpi_id, period_date);
