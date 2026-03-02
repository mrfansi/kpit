CREATE INDEX IF NOT EXISTS idx_kpi_entries_kpi_id ON kpi_entries(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_entries_period ON kpi_entries(period_date);
CREATE INDEX IF NOT EXISTS idx_kpi_entries_kpi_period ON kpi_entries(kpi_id, period_date);
CREATE INDEX IF NOT EXISTS idx_kpi_targets_kpi_period ON kpi_targets(kpi_id, period_date);
CREATE INDEX IF NOT EXISTS idx_kpi_comments_kpi_id ON kpi_comments(kpi_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_kpis_domain_id ON kpis(domain_id);
