CREATE TABLE timeline_project_statuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#9ca3af',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Seed default statuses
INSERT INTO timeline_project_statuses (name, slug, color, sort_order) VALUES
  ('Not Started', 'not_started', '#9ca3af', 0),
  ('On-Track', 'on_track', '#3b82f6', 1),
  ('On-Hold', 'on_hold', '#f59e0b', 2),
  ('Delayed', 'delayed', '#ef4444', 3),
  ('Launched', 'launched', '#22c55e', 4);

-- Add FK column to projects (nullable, references statuses)
ALTER TABLE timeline_projects ADD COLUMN status_id INTEGER REFERENCES timeline_project_statuses(id);
