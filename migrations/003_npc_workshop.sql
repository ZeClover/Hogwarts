CREATE TABLE npcs (
 id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PREPARED','PUBLISHED','ARCHIVED')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 draft_json TEXT NOT NULL CHECK(json_valid(draft_json)),
 draft_policy_json TEXT NOT NULL CHECK(json_valid(draft_policy_json)), private_notes TEXT NOT NULL DEFAULT '',
 published_json TEXT CHECK(published_json IS NULL OR json_valid(published_json)),
 published_policy_json TEXT CHECK(published_policy_json IS NULL OR json_valid(published_policy_json)),
 published_revision INTEGER, published_at INTEGER,
 created_at INTEGER NOT NULL DEFAULT(unixepoch()), updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE npc_revisions (
 npc_id TEXT NOT NULL REFERENCES npcs(id), version INTEGER NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id),
 action TEXT NOT NULL, snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
 created_at INTEGER NOT NULL DEFAULT(unixepoch()), PRIMARY KEY(npc_id,version)
);
CREATE TABLE npc_reveals (
 npc_id TEXT NOT NULL REFERENCES npcs(id), fragment_id TEXT NOT NULL,
 character_id TEXT NOT NULL REFERENCES characters(id), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)), source_revision INTEGER NOT NULL,
 actor_id TEXT NOT NULL REFERENCES users(id), updated_at INTEGER NOT NULL DEFAULT(unixepoch()),
 PRIMARY KEY(npc_id,fragment_id,character_id)
);
CREATE TABLE npc_location_links (
 npc_id TEXT NOT NULL REFERENCES npcs(id), location_id TEXT NOT NULL REFERENCES locations(id),
 PRIMARY KEY(npc_id,location_id)
);
CREATE INDEX npcs_status ON npcs(status,updated_at);
CREATE INDEX npc_reveals_character ON npc_reveals(character_id,npc_id,active);
CREATE INDEX npc_links_location ON npc_location_links(location_id,npc_id);
