CREATE TABLE catalog_items (
 id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PREPARED','PUBLISHED','ARCHIVED')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 draft_json TEXT NOT NULL CHECK(json_valid(draft_json)),
 draft_policy_json TEXT NOT NULL CHECK(json_valid(draft_policy_json)),
 private_json TEXT NOT NULL CHECK(json_valid(private_json)),
 published_json TEXT CHECK(published_json IS NULL OR json_valid(published_json)),
 published_policy_json TEXT CHECK(published_policy_json IS NULL OR json_valid(published_policy_json)),
 published_revision INTEGER, published_at INTEGER,
 created_at INTEGER NOT NULL DEFAULT(unixepoch()), updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE item_revisions (
 item_id TEXT NOT NULL REFERENCES catalog_items(id), version INTEGER NOT NULL,
 actor_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL,
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
 created_at INTEGER NOT NULL DEFAULT(unixepoch()), PRIMARY KEY(item_id,version)
);
CREATE INDEX items_status ON catalog_items(status,updated_at);
