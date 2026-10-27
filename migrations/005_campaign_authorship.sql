CREATE TABLE quests (
 id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PREPARED','PUBLISHED','ARCHIVED')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 draft_json TEXT NOT NULL CHECK(json_valid(draft_json)), draft_policy_json TEXT NOT NULL CHECK(json_valid(draft_policy_json)),
 private_json TEXT NOT NULL CHECK(json_valid(private_json)),
 published_json TEXT CHECK(published_json IS NULL OR json_valid(published_json)),
 published_policy_json TEXT CHECK(published_policy_json IS NULL OR json_valid(published_policy_json)),
 published_revision INTEGER, published_at INTEGER,
 created_at INTEGER NOT NULL DEFAULT(unixepoch()), updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE personal_story_arcs (
 id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PREPARED','PUBLISHED','ARCHIVED')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 draft_json TEXT NOT NULL CHECK(json_valid(draft_json)), draft_policy_json TEXT NOT NULL CHECK(json_valid(draft_policy_json)),
 private_json TEXT NOT NULL CHECK(json_valid(private_json)),
 published_json TEXT CHECK(published_json IS NULL OR json_valid(published_json)),
 published_policy_json TEXT CHECK(published_policy_json IS NULL OR json_valid(published_policy_json)),
 published_revision INTEGER, published_at INTEGER,
 created_at INTEGER NOT NULL DEFAULT(unixepoch()), updated_at INTEGER NOT NULL DEFAULT(unixepoch()),
 protagonist_id TEXT NOT NULL REFERENCES characters(id), released_at INTEGER,
 access_active INTEGER NOT NULL DEFAULT 0 CHECK(access_active IN (0,1))
);
CREATE TABLE quest_participants (
 quest_id TEXT NOT NULL REFERENCES quests(id), character_id TEXT NOT NULL REFERENCES characters(id),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), state TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(state IN ('AVAILABLE','IN_PROGRESS')),
 released_revision INTEGER NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id),
 released_at INTEGER NOT NULL DEFAULT(unixepoch()), started_at INTEGER, PRIMARY KEY(quest_id,character_id)
);
CREATE TABLE personal_story_entries (
 id TEXT PRIMARY KEY, arc_id TEXT NOT NULL REFERENCES personal_story_arcs(id), position INTEGER NOT NULL CHECK(position>=0),
 draft_json TEXT NOT NULL CHECK(json_valid(draft_json)), private_notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE personal_story_reveals (
 arc_id TEXT NOT NULL REFERENCES personal_story_arcs(id), entry_id TEXT NOT NULL, character_id TEXT NOT NULL REFERENCES characters(id),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), position INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)), source_revision INTEGER NOT NULL,
 actor_id TEXT NOT NULL REFERENCES users(id), updated_at INTEGER NOT NULL DEFAULT(unixepoch()), PRIMARY KEY(arc_id,entry_id,character_id)
);
CREATE TABLE quest_revisions (
 record_id TEXT NOT NULL REFERENCES quests(id), version INTEGER NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id),
 action TEXT NOT NULL, snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)), created_at INTEGER NOT NULL DEFAULT(unixepoch()),
 PRIMARY KEY(record_id,version)
);
CREATE TABLE story_revisions (
 record_id TEXT NOT NULL REFERENCES personal_story_arcs(id), version INTEGER NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id),
 action TEXT NOT NULL, snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)), created_at INTEGER NOT NULL DEFAULT(unixepoch()),
 PRIMARY KEY(record_id,version)
);
CREATE INDEX quest_access ON quest_participants(character_id,active,quest_id);
CREATE INDEX quests_status ON quests(status,updated_at);
CREATE INDEX story_owner ON personal_story_arcs(protagonist_id,access_active,status);
CREATE INDEX story_entry_order ON personal_story_entries(arc_id,position,id);
CREATE INDEX story_reveal_access ON personal_story_reveals(character_id,arc_id,active);
