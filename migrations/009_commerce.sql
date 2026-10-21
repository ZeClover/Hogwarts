CREATE TABLE wallet_entries (
 id TEXT PRIMARY KEY, character_id TEXT NOT NULL REFERENCES characters(id), amount INTEGER NOT NULL CHECK(amount!=0),
 kind TEXT NOT NULL CHECK(kind IN('ADJUSTMENT','PURCHASE','REWARD')), title TEXT NOT NULL, private_reason TEXT NOT NULL,
 command_key TEXT NOT NULL UNIQUE, actor_id TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE purchase_orders (
 id TEXT PRIMARY KEY, character_id TEXT NOT NULL REFERENCES characters(id), offer_id TEXT NOT NULL REFERENCES content_records(id),
 request_key TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 99), version INTEGER NOT NULL DEFAULT 1,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','APPROVED','REJECTED','CANCELLED')),
 requested_json TEXT NOT NULL, receipt_json TEXT, private_reason TEXT NOT NULL DEFAULT '',
 image_file_id TEXT REFERENCES workshop_files(id), image_crop_json TEXT,
 actor_id TEXT REFERENCES users(id), created_at INTEGER NOT NULL DEFAULT(unixepoch()), UNIQUE(character_id,request_key)
);
CREATE INDEX wallet_character ON wallet_entries(character_id,created_at);
CREATE INDEX pending_orders ON purchase_orders(status,character_id);
