CREATE TABLE archive_uploads (
 id TEXT PRIMARY KEY,
 actor_id TEXT NOT NULL REFERENCES users(id),
 storage_key TEXT NOT NULL UNIQUE,
 bytes INTEGER NOT NULL CHECK(bytes>0 AND bytes<=134217728),
 expires_at INTEGER NOT NULL
);
CREATE INDEX archive_uploads_owner_expiry ON archive_uploads(actor_id,expires_at);
