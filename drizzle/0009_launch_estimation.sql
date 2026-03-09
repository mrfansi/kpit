ALTER TABLE timeline_projects ADD COLUMN launch_buffer_days integer NOT NULL DEFAULT 7;
ALTER TABLE timeline_projects ADD COLUMN estimated_launch_date text;
