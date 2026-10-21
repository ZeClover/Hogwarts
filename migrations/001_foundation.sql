CREATE TABLE houses (id TEXT PRIMARY KEY, name TEXT NOT NULL, crest TEXT NOT NULL, room TEXT NOT NULL);
CREATE TABLE characters (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, house_id TEXT NOT NULL REFERENCES houses(id),
 school_year INTEGER CHECK(school_year BETWEEN 1 AND 7), biography TEXT NOT NULL DEFAULT '', photo_id TEXT,
 updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('MASTER','PLAYER')),
 character_id TEXT UNIQUE REFERENCES characters(id), disabled INTEGER NOT NULL DEFAULT 0,
 CHECK(role = 'MASTER' OR character_id IS NOT NULL)
);
CREATE TABLE invites (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, email TEXT NOT NULL COLLATE NOCASE,
 role TEXT NOT NULL CHECK(role IN ('MASTER','PLAYER')), character_id TEXT REFERENCES characters(id),
 expires_at INTEGER NOT NULL, used_at INTEGER, revoked_at INTEGER, created_by TEXT REFERENCES users(id),
 CHECK(role = 'MASTER' OR character_id IS NOT NULL)
);
CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 csrf TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE access_groups (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE group_members (
 group_id TEXT REFERENCES access_groups(id) ON DELETE CASCADE,
 character_id TEXT REFERENCES characters(id) ON DELETE CASCADE, PRIMARY KEY(group_id, character_id)
);
CREATE TABLE regions (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, is_open INTEGER NOT NULL DEFAULT 0,
 audience TEXT NOT NULL DEFAULT 'SELECTED' CHECK(audience IN ('ALL','SELECTED'))
);
CREATE TABLE locations (
 id TEXT PRIMARY KEY, region_id TEXT NOT NULL REFERENCES regions(id), title TEXT NOT NULL,
 image TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('SHOP','LIBRARY','ARCHIVE')),
 is_secret INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1,
 audience TEXT NOT NULL DEFAULT 'ALL' CHECK(audience IN ('ALL','SELECTED')),
 x REAL CHECK(x BETWEEN 0 AND 100), y REAL CHECK(y BETWEEN 0 AND 100)
);
CREATE TABLE access_grants (
 id TEXT PRIMARY KEY, resource_type TEXT NOT NULL CHECK(resource_type IN ('REGION','LOCATION','PUBLICATION','MEDIA')),
 resource_id TEXT NOT NULL, character_id TEXT REFERENCES characters(id) ON DELETE CASCADE,
 group_id TEXT REFERENCES access_groups(id) ON DELETE CASCADE,
 CHECK((character_id IS NOT NULL) != (group_id IS NOT NULL))
);
CREATE UNIQUE INDEX grants_character ON access_grants(resource_type, resource_id, character_id) WHERE character_id IS NOT NULL;
CREATE UNIQUE INDEX grants_group ON access_grants(resource_type, resource_id, group_id) WHERE group_id IS NOT NULL;
CREATE TABLE media (
 id TEXT PRIMARY KEY, owner_character_id TEXT NOT NULL REFERENCES characters(id),
 storage_key TEXT NOT NULL UNIQUE, mime TEXT NOT NULL, bytes INTEGER NOT NULL, created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE publications (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('LETTER','NEWSPAPER','MISSION','CONTENT')),
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PUBLISHED')),
 audience TEXT NOT NULL DEFAULT 'SELECTED' CHECK(audience IN ('ALL','SELECTED')),
 region_id TEXT REFERENCES regions(id), location_id TEXT REFERENCES locations(id),
 media_id TEXT REFERENCES media(id), campaign_year INTEGER NOT NULL CHECK(campaign_year IN (1890,1891)),
 published_at INTEGER
);
CREATE TABLE audit_log (
 id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT REFERENCES users(id),
 action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL,
 details TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE auth_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL);
CREATE INDEX grants_resource ON access_grants(resource_type,resource_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);
