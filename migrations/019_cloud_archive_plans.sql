CREATE TABLE archive_operation_plans (
 id TEXT PRIMARY KEY,
 actor_id TEXT NOT NULL REFERENCES users(id),
 storage_key TEXT NOT NULL UNIQUE,
 expires_at INTEGER NOT NULL,
 state TEXT NOT NULL DEFAULT 'READY' CHECK(state IN ('READY','APPLYING'))
);
CREATE INDEX archive_plans_owner_expiry ON archive_operation_plans(actor_id,expires_at);
