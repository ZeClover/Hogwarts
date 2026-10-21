ALTER TABLE quests ADD COLUMN operation_state TEXT NOT NULL DEFAULT 'OPEN' CHECK(operation_state IN ('OPEN','CLOSED'));
CREATE TABLE quest_objectives (
 id TEXT PRIMARY KEY, quest_id TEXT NOT NULL REFERENCES quests(id), position INTEGER NOT NULL,
 draft_json TEXT NOT NULL CHECK(json_valid(draft_json)), private_notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE quest_objective_progress (
 quest_id TEXT NOT NULL REFERENCES quests(id), objective_id TEXT NOT NULL, character_id TEXT NOT NULL REFERENCES characters(id),
 state TEXT NOT NULL CHECK(state IN ('HIDDEN','REVEALED','IN_PROGRESS','COMPLETED','FAILED','CANCELLED')),
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)), source_revision INTEGER NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id),
 PRIMARY KEY(quest_id,objective_id,character_id)
);
CREATE TABLE quest_clues (
 id TEXT PRIMARY KEY, quest_id TEXT NOT NULL REFERENCES quests(id), position INTEGER NOT NULL,
 draft_json TEXT NOT NULL CHECK(json_valid(draft_json)), private_notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE quest_clue_reveals (
 quest_id TEXT NOT NULL REFERENCES quests(id), clue_id TEXT NOT NULL, character_id TEXT NOT NULL REFERENCES characters(id),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
 source_revision INTEGER NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id), event_id TEXT,
 PRIMARY KEY(quest_id,clue_id,character_id)
);
CREATE TABLE quest_outcomes (
 id TEXT PRIMARY KEY, quest_id TEXT NOT NULL REFERENCES quests(id), version INTEGER NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id),
 public_json TEXT NOT NULL CHECK(json_valid(public_json)), private_notes TEXT NOT NULL,
 characters_json TEXT NOT NULL CHECK(json_valid(characters_json)), created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE delivery_events (
 id TEXT PRIMARY KEY, character_id TEXT NOT NULL REFERENCES characters(id), type TEXT NOT NULL,
 resource_id TEXT NOT NULL, fragment_id TEXT, presentation TEXT NOT NULL CHECK(presentation IN ('ANIMATED','SILENT')),
 created_at INTEGER NOT NULL DEFAULT(unixepoch()), acknowledged_at INTEGER
);
CREATE INDEX objectives_quest ON quest_objectives(quest_id,position,id);
CREATE INDEX clues_quest ON quest_clues(quest_id,position,id);
CREATE INDEX events_recipient ON delivery_events(character_id,acknowledged_at,created_at,id);
