CREATE INDEX IF NOT EXISTS idx_kpis_active_domain_sort ON kpis(is_active, domain_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_kpis_pinned_active_sort ON kpis(is_pinned, is_active, domain_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_timeline_projects_sort ON timeline_projects(sort_order);
CREATE INDEX IF NOT EXISTS idx_timeline_projects_status_sort ON timeline_projects(status_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_timeline_projects_dates ON timeline_projects(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_timeline_project_logs_project_created ON timeline_project_logs(project_id, created_at);
