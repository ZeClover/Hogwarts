CREATE TABLE content_records (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL, owner_user_id TEXT REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','PREPARED','PUBLISHED','ARCHIVED')),
 version INTEGER NOT NULL DEFAULT 1, draft_json TEXT NOT NULL CHECK(json_valid(draft_json)),
 draft_policy_json TEXT NOT NULL CHECK(json_valid(draft_policy_json)), private_notes TEXT NOT NULL DEFAULT '',
 published_json TEXT, published_policy_json TEXT, published_revision INTEGER,
 created_at INTEGER NOT NULL DEFAULT(unixepoch()), updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE content_revisions (
 record_id TEXT NOT NULL REFERENCES content_records(id), version INTEGER NOT NULL, actor_id TEXT REFERENCES users(id),
 action TEXT NOT NULL, snapshot_json TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT(unixepoch()), PRIMARY KEY(record_id,version)
);
ALTER TABLE regions ADD COLUMN editorial_policy_json TEXT;
ALTER TABLE regions ADD COLUMN file_id TEXT REFERENCES workshop_files(id);
ALTER TABLE locations ADD COLUMN editorial_policy_json TEXT;
ALTER TABLE locations ADD COLUMN file_id TEXT REFERENCES workshop_files(id);
ALTER TABLE locations ADD COLUMN destination TEXT NOT NULL DEFAULT 'LOCATION';
CREATE TABLE offer_stock(offer_id TEXT PRIMARY KEY REFERENCES content_records(id),remaining INTEGER CHECK(remaining IS NULL OR remaining>=0));
INSERT INTO content_records(id,kind,status,draft_json,draft_policy_json,published_json,published_policy_json,published_revision)
 SELECT id,'regions','PUBLISHED',json_object('title',title,'description','','fileId',NULL,'alt','','asset','hogsmeade_mapa_limpo.webp'),
 '{"audience":"ALL","characters":[],"groups":[],"houses":[],"schoolYears":[],"cohorts":[],"excludedCharacters":[],"regionId":null,"locationId":null}',
 json_object('title',title,'description','','fileId',NULL,'alt','','asset','hogsmeade_mapa_limpo.webp'),
 '{"audience":"ALL","characters":[],"groups":[],"houses":[],"schoolYears":[],"cohorts":[],"excludedCharacters":[],"regionId":null,"locationId":null}',1 FROM regions;
INSERT INTO content_records(id,kind,status,draft_json,draft_policy_json,published_json,published_policy_json,published_revision)
 SELECT id,'places','PUBLISHED',json_object('title',title,'description','','regionId',region_id,'kind',kind,'fileId',NULL,'alt','','asset',image,'isSecret',json(iif(is_secret,'true','false')),'x',x,'y',y,'destination','LOCATION'),
 '{"audience":"ALL","characters":[],"groups":[],"houses":[],"schoolYears":[],"cohorts":[],"excludedCharacters":[],"regionId":null,"locationId":null}',
 json_object('title',title,'description','','regionId',region_id,'kind',kind,'fileId',NULL,'alt','','asset',image,'isSecret',json(iif(is_secret,'true','false')),'x',x,'y',y,'destination','LOCATION'),
 '{"audience":"ALL","characters":[],"groups":[],"houses":[],"schoolYears":[],"cohorts":[],"excludedCharacters":[],"regionId":null,"locationId":null}',1 FROM locations;
CREATE INDEX content_kind_state ON content_records(kind,status,updated_at);

CREATE TRIGGER world_regions_profile AFTER INSERT ON regions BEGIN
INSERT OR IGNORE INTO content_records(id,kind,status,draft_json,draft_policy_json,published_json,published_policy_json,published_revision)
 SELECT NEW.id,'regions','PUBLISHED',json_object('title',NEW.title,'description','','fileId',NULL,'alt','','asset','hogsmeade_mapa_limpo.webp'),
 '{"audience":"ALL","characters":[],"groups":[],"houses":[],"schoolYears":[],"cohorts":[],"excludedCharacters":[],"regionId":null,"locationId":null}',
 json_object('title',NEW.title,'description','','fileId',NULL,'alt','','asset','hogsmeade_mapa_limpo.webp'),
 '{"audience":"ALL","characters":[],"groups":[],"houses":[],"schoolYears":[],"cohorts":[],"excludedCharacters":[],"regionId":null,"locationId":null}',1;
END;

CREATE TRIGGER world_locations_profile AFTER INSERT ON locations BEGIN
INSERT OR IGNORE INTO content_records(id,kind,status,draft_json,draft_policy_json,published_json,published_policy_json,published_revision)
 SELECT NEW.id,'places','PUBLISHED',json_object('title',NEW.title,'description','','regionId',NEW.region_id,'kind',NEW.kind,'fileId',NULL,'alt','','asset',NEW.image,'isSecret',json(iif(NEW.is_secret,'true','false')),'x',NEW.x,'y',NEW.y,'destination','LOCATION'),
 '{"audience":"ALL","characters":[],"groups":[],"houses":[],"schoolYears":[],"cohorts":[],"excludedCharacters":[],"regionId":null,"locationId":null}',
 json_object('title',NEW.title,'description','','regionId',NEW.region_id,'kind',NEW.kind,'fileId',NULL,'alt','','asset',NEW.image,'isSecret',json(iif(NEW.is_secret,'true','false')),'x',NEW.x,'y',NEW.y,'destination','LOCATION'),
 '{"audience":"ALL","characters":[],"groups":[],"houses":[],"schoolYears":[],"cohorts":[],"excludedCharacters":[],"regionId":null,"locationId":null}',1;
END;
