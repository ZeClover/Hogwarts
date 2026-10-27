CREATE TABLE content_page_reveals (
 record_id TEXT NOT NULL REFERENCES content_records(id), page_id TEXT NOT NULL, character_id TEXT NOT NULL REFERENCES characters(id),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)), position INTEGER NOT NULL, snapshot_json TEXT NOT NULL,
 source_revision INTEGER NOT NULL, event_id TEXT REFERENCES delivery_events(id), actor_id TEXT NOT NULL REFERENCES users(id),
 PRIMARY KEY(record_id,page_id,character_id)
);
CREATE INDEX page_knowledge ON content_page_reveals(character_id,record_id,active);
