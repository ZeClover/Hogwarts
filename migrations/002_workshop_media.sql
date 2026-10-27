-- Narrative media has an administrative owner; legacy portraits keep their own policy/table.
CREATE TABLE workshop_files (
 id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL REFERENCES users(id),
 storage_key TEXT NOT NULL UNIQUE, mime TEXT NOT NULL CHECK(mime='image/webp'),
 bytes INTEGER NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
 origin_asset TEXT, created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE editorial_entries (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL DEFAULT 'MEDIA' CHECK(kind='MEDIA'),
 owner_user_id TEXT NOT NULL REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PREPARED','PUBLISHED','ARCHIVED')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 draft_json TEXT NOT NULL CHECK(json_valid(draft_json)),
 draft_policy_json TEXT NOT NULL CHECK(json_valid(draft_policy_json)),
 private_notes TEXT NOT NULL DEFAULT '',
 published_json TEXT CHECK(published_json IS NULL OR json_valid(published_json)),
 published_policy_json TEXT CHECK(published_policy_json IS NULL OR json_valid(published_policy_json)),
 published_revision INTEGER, published_at INTEGER,
 created_at INTEGER NOT NULL DEFAULT(unixepoch()), updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE editorial_revisions (
 entry_id TEXT NOT NULL REFERENCES editorial_entries(id), version INTEGER NOT NULL,
 actor_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL,
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)), created_at INTEGER NOT NULL DEFAULT(unixepoch()),
 PRIMARY KEY(entry_id, version)
);
CREATE TABLE school_cohorts (id TEXT PRIMARY KEY, name TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE cohort_members (
 cohort_id TEXT NOT NULL REFERENCES school_cohorts(id) ON DELETE CASCADE,
 character_id TEXT NOT NULL REFERENCES characters(id), PRIMARY KEY(cohort_id,character_id)
);
CREATE INDEX editorial_status ON editorial_entries(status,updated_at);
CREATE INDEX editorial_history ON editorial_revisions(entry_id,version DESC);
