-- Add a reusable display name; existing private files and references stay intact.
ALTER TABLE workshop_files ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
