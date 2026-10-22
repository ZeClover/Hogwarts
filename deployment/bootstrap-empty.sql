-- Hogwarts 1890: inicializacao de um banco libSQL NOVO e VAZIO.
-- Gerado por npm run db:bootstrap-sql. Nenhum token, senha ou convite.
-- Executar o lote completo em uma transacao, interrompendo em caso de erro.
PRAGMA foreign_keys=ON;
BEGIN IMMEDIATE;
CREATE TABLE hogwarts_bootstrap_guard(empty INTEGER NOT NULL CHECK(empty=0));
INSERT INTO hogwarts_bootstrap_guard SELECT count(*) FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'hogwarts_bootstrap_guard';
DROP TABLE hogwarts_bootstrap_guard;
CREATE TABLE schema_migrations(name TEXT PRIMARY KEY, applied_at INTEGER DEFAULT(unixepoch()));

-- 001_foundation.sql
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

INSERT INTO schema_migrations(name) VALUES('001_foundation.sql');

-- 002_workshop_media.sql
-- Narrative media has an administrative owner; legacy portraits keep their own policy/table.
CREATE TABLE workshop_files (
 id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL REFERENCES users(id),
 storage_key TEXT NOT NULL UNIQUE, mime TEXT NOT NULL CHECK(mime='image/webp'),
 bytes INTEGER NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
 origin_asset TEXT, created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE editorial_entries (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL DEFAULT 'MEDIA' CHECK(kind='MEDIA'),
 owner_user_id TEXT NOT NULL REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PREPARED','PUBLISHED','ARCHIVED')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 draft_json TEXT NOT NULL CHECK(json_valid(draft_json)),
 draft_policy_json TEXT NOT NULL CHECK(json_valid(draft_policy_json)),
 private_notes TEXT NOT NULL DEFAULT '',
 published_json TEXT CHECK(published_json IS NULL OR json_valid(published_json)),
 published_policy_json TEXT CHECK(published_policy_json IS NULL OR json_valid(published_policy_json)),
 published_revision INTEGER, published_at INTEGER,
 created_at INTEGER NOT NULL DEFAULT(unixepoch()), updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE editorial_revisions (
 entry_id TEXT NOT NULL REFERENCES editorial_entries(id), version INTEGER NOT NULL,
 actor_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL,
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)), created_at INTEGER NOT NULL DEFAULT(unixepoch()),
 PRIMARY KEY(entry_id, version)
);
CREATE TABLE school_cohorts (id TEXT PRIMARY KEY, name TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE cohort_members (
 cohort_id TEXT NOT NULL REFERENCES school_cohorts(id) ON DELETE CASCADE,
 character_id TEXT NOT NULL REFERENCES characters(id), PRIMARY KEY(cohort_id,character_id)
);
CREATE INDEX editorial_status ON editorial_entries(status,updated_at);
CREATE INDEX editorial_history ON editorial_revisions(entry_id,version DESC);

INSERT INTO schema_migrations(name) VALUES('002_workshop_media.sql');

-- 003_npc_workshop.sql
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

INSERT INTO schema_migrations(name) VALUES('003_npc_workshop.sql');

-- 004_item_workshop.sql
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

INSERT INTO schema_migrations(name) VALUES('004_item_workshop.sql');

-- 005_campaign_authorship.sql
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

INSERT INTO schema_migrations(name) VALUES('005_campaign_authorship.sql');

-- 006_quest_operations.sql
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

INSERT INTO schema_migrations(name) VALUES('006_quest_operations.sql');

-- 007_quest_documents.sql
CREATE TABLE quest_certificates (
 id TEXT PRIMARY KEY, quest_id TEXT NOT NULL REFERENCES quests(id), character_id TEXT NOT NULL REFERENCES characters(id),
 version INTEGER NOT NULL DEFAULT 1, draft_json TEXT NOT NULL CHECK(json_valid(draft_json)),
 actor_id TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE certificate_issues (
 id TEXT PRIMARY KEY, certificate_id TEXT NOT NULL REFERENCES quest_certificates(id), certificate_version INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)), pdf_base64 TEXT NOT NULL,
 released INTEGER NOT NULL DEFAULT 0 CHECK(released IN(0,1)), shares_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(shares_json)),
 actor_id TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL DEFAULT(unixepoch()),
 UNIQUE(certificate_id,certificate_version)
);
CREATE TABLE certificate_revisions (
 certificate_id TEXT NOT NULL REFERENCES quest_certificates(id), version INTEGER NOT NULL, snapshot_json TEXT NOT NULL,
 actor_id TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL DEFAULT(unixepoch()), PRIMARY KEY(certificate_id,version)
);
CREATE TABLE reward_plans (
 id TEXT PRIMARY KEY, quest_id TEXT NOT NULL REFERENCES quests(id), version INTEGER NOT NULL DEFAULT 1,
 plan_json TEXT NOT NULL CHECK(json_valid(plan_json)), granted INTEGER NOT NULL DEFAULT 0 CHECK(granted IN(0,1)),
 actor_id TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE reward_grants (
 id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES reward_plans(id), character_id TEXT NOT NULL REFERENCES characters(id),
 receipt_json TEXT NOT NULL CHECK(json_valid(receipt_json)), actor_id TEXT NOT NULL REFERENCES users(id),
 created_at INTEGER NOT NULL DEFAULT(unixepoch()), UNIQUE(plan_id,character_id)
);
CREATE INDEX issued_certificates ON certificate_issues(certificate_id,released);
CREATE INDEX recipient_rewards ON reward_grants(character_id,plan_id);

INSERT INTO schema_migrations(name) VALUES('007_quest_documents.sql');

-- 008_world_workshops.sql
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

INSERT INTO schema_migrations(name) VALUES('008_world_workshops.sql');

-- 009_commerce.sql
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

INSERT INTO schema_migrations(name) VALUES('009_commerce.sql');

-- 010_library.sql
CREATE TABLE content_page_reveals (
 record_id TEXT NOT NULL REFERENCES content_records(id), page_id TEXT NOT NULL, character_id TEXT NOT NULL REFERENCES characters(id),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)), position INTEGER NOT NULL, snapshot_json TEXT NOT NULL,
 source_revision INTEGER NOT NULL, event_id TEXT REFERENCES delivery_events(id), actor_id TEXT NOT NULL REFERENCES users(id),
 PRIMARY KEY(record_id,page_id,character_id)
);
CREATE INDEX page_knowledge ON content_page_reveals(character_id,record_id,active);

INSERT INTO schema_migrations(name) VALUES('010_library.sql');

-- 011_school_calendar.sql
CREATE TABLE school_years(id TEXT PRIMARY KEY,record_id TEXT NOT NULL UNIQUE REFERENCES content_records(id),label TEXT NOT NULL,start_year INTEGER NOT NULL UNIQUE,archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN(0,1)));
INSERT INTO content_records(id,kind,status,draft_json,draft_policy_json,published_json,published_policy_json,published_revision)
 VALUES('academic-year-1890','years','PUBLISHED','{"title":"1890–1891","startYear":1890}',
 '{"audience":"ALL","characters":[],"groups":[],"houses":[],"schoolYears":[],"cohorts":[],"excludedCharacters":[],"regionId":null,"locationId":null}',
 '{"title":"1890–1891","startYear":1890}',
 '{"audience":"ALL","characters":[],"groups":[],"houses":[],"schoolYears":[],"cohorts":[],"excludedCharacters":[],"regionId":null,"locationId":null}',1);
INSERT INTO school_years VALUES('1890–1891','academic-year-1890','1890–1891',1890,0);
CREATE TABLE calendar_state(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL DEFAULT 1,draft_json TEXT NOT NULL,published_json TEXT NOT NULL);
INSERT INTO calendar_state(id,draft_json,published_json) VALUES(1,'{"academicYear":"1890–1891","narrativeDate":""}','{"academicYear":"1890–1891","narrativeDate":""}');
ALTER TABLE publications RENAME TO publications_f0;
CREATE TABLE publications (
 id TEXT PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN('LETTER','NEWSPAPER','MISSION','CONTENT')),
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','PUBLISHED')),
 audience TEXT NOT NULL DEFAULT 'SELECTED' CHECK(audience IN('ALL','SELECTED')),
 region_id TEXT REFERENCES regions(id),location_id TEXT REFERENCES locations(id),media_id TEXT REFERENCES media(id),
 campaign_year INTEGER NOT NULL CHECK(campaign_year BETWEEN 1 AND 9998),published_at INTEGER
);
INSERT INTO publications SELECT * FROM publications_f0;
DROP TABLE publications_f0;

INSERT INTO schema_migrations(name) VALUES('011_school_calendar.sql');

-- 012_boards.sql
CREATE TABLE board_proposals (
 id TEXT PRIMARY KEY,board_id TEXT NOT NULL REFERENCES content_records(id),character_id TEXT NOT NULL REFERENCES characters(id),
 version INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK(status IN('SUBMITTED','APPROVED','REJECTED')),
 draft_json TEXT NOT NULL,approved_record_id TEXT UNIQUE REFERENCES content_records(id),private_reason TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE board_proposal_revisions(proposal_id TEXT NOT NULL REFERENCES board_proposals(id),version INTEGER NOT NULL,snapshot_json TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(proposal_id,version));

INSERT INTO schema_migrations(name) VALUES('012_boards.sql');

-- 013_house_cup.sql
CREATE TABLE house_competitions(academic_year TEXT PRIMARY KEY REFERENCES school_years(id),version INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','CLOSED')));
CREATE TABLE house_point_entries(id TEXT PRIMARY KEY,academic_year TEXT NOT NULL REFERENCES house_competitions(academic_year),house_id TEXT NOT NULL REFERENCES houses(id),amount INTEGER NOT NULL CHECK(amount!=0 AND abs(amount)<=1000000),reason TEXT NOT NULL,character_id TEXT REFERENCES characters(id),event_id TEXT REFERENCES content_records(id),command_key TEXT NOT NULL UNIQUE,actor_id TEXT NOT NULL REFERENCES users(id),created_at INTEGER NOT NULL DEFAULT(unixepoch()));
CREATE TABLE house_results(id TEXT PRIMARY KEY,academic_year TEXT NOT NULL REFERENCES house_competitions(academic_year),version INTEGER NOT NULL,snapshot_json TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),created_at INTEGER NOT NULL DEFAULT(unixepoch()),UNIQUE(academic_year,version));

INSERT INTO schema_migrations(name) VALUES('013_house_cup.sql');

-- 014_collections.sql
CREATE TABLE collection_discoveries(record_id TEXT NOT NULL REFERENCES content_records(id),character_id TEXT NOT NULL REFERENCES characters(id),active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),snapshot_json TEXT NOT NULL,source_revision INTEGER NOT NULL,event_id TEXT REFERENCES delivery_events(id),actor_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(record_id,character_id));
CREATE TABLE collection_notes(record_id TEXT NOT NULL REFERENCES content_records(id),character_id TEXT NOT NULL REFERENCES characters(id),version INTEGER NOT NULL DEFAULT 1,body TEXT NOT NULL,PRIMARY KEY(record_id,character_id));
CREATE TABLE curiosity_proposals(id TEXT PRIMARY KEY,character_id TEXT NOT NULL REFERENCES characters(id),version INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK(status IN('SUBMITTED','APPROVED','REJECTED')),payload_json TEXT NOT NULL,record_id TEXT REFERENCES content_records(id),private_reason TEXT NOT NULL DEFAULT '');
CREATE TABLE collection_reveal_history(id TEXT PRIMARY KEY,record_id TEXT NOT NULL REFERENCES content_records(id),character_id TEXT NOT NULL REFERENCES characters(id),action TEXT NOT NULL,snapshot_json TEXT,actor_id TEXT NOT NULL REFERENCES users(id),created_at INTEGER NOT NULL DEFAULT(unixepoch()));

INSERT INTO schema_migrations(name) VALUES('014_collections.sql');

-- 015_chocolate_packets.sql
CREATE TABLE packet_grants(id TEXT PRIMARY KEY,command_key TEXT NOT NULL UNIQUE,request_json TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id));
CREATE TABLE packet_batches(id TEXT PRIMARY KEY,grant_id TEXT NOT NULL REFERENCES packet_grants(id),character_id TEXT NOT NULL REFERENCES characters(id),pool_id TEXT NOT NULL REFERENCES content_records(id),pool_snapshot_json TEXT NOT NULL,title TEXT NOT NULL,origin TEXT NOT NULL);
CREATE TABLE chocolate_packets(id TEXT PRIMARY KEY,batch_id TEXT NOT NULL REFERENCES packet_batches(id),character_id TEXT NOT NULL REFERENCES characters(id),status TEXT NOT NULL DEFAULT 'SEALED' CHECK(status IN('SEALED','OPENED','CANCELLED')),card_id TEXT REFERENCES content_records(id),card_snapshot_json TEXT,private_reason TEXT NOT NULL DEFAULT '');
CREATE TABLE chocolate_copies(id TEXT PRIMARY KEY,character_id TEXT NOT NULL REFERENCES characters(id),card_id TEXT NOT NULL REFERENCES content_records(id),snapshot_json TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,packet_id TEXT NOT NULL UNIQUE REFERENCES chocolate_packets(id));
CREATE TABLE chocolate_trades(id TEXT PRIMARY KEY,command_key TEXT NOT NULL UNIQUE,request_json TEXT NOT NULL,snapshot_json TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id));

INSERT INTO schema_migrations(name) VALUES('015_chocolate_packets.sql');

-- 016_letters.sql
CREATE TABLE letters(id TEXT PRIMARY KEY,author_user_id TEXT NOT NULL REFERENCES users(id),sender_character_id TEXT REFERENCES characters(id),version INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','SUBMITTED','HELD','RETURNED','LOST','DELIVERED')),draft_json TEXT NOT NULL,sent_json TEXT,private_reason TEXT NOT NULL DEFAULT '',image_base64 TEXT,archived_by_author INTEGER NOT NULL DEFAULT 0);
CREATE INDEX letters_author ON letters(author_user_id,status);
CREATE TABLE letter_revisions(id TEXT PRIMARY KEY,letter_id TEXT NOT NULL REFERENCES letters(id),version INTEGER NOT NULL,snapshot_json TEXT NOT NULL,UNIQUE(letter_id,version));

INSERT INTO schema_migrations(name) VALUES('016_letters.sql');

-- 017_investigations.sql
CREATE TABLE investigation_cases(id TEXT PRIMARY KEY,owner_character_id TEXT NOT NULL REFERENCES characters(id),members_json TEXT NOT NULL,title TEXT NOT NULL,summary TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','ARCHIVED')),private_warning TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE investigation_notes(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES investigation_cases(id),author_user_id TEXT NOT NULL REFERENCES users(id),character_id TEXT NOT NULL REFERENCES characters(id),body TEXT NOT NULL,hidden INTEGER NOT NULL DEFAULT 0,version INTEGER NOT NULL DEFAULT 1);
CREATE INDEX investigation_notes_case ON investigation_notes(case_id);
CREATE TABLE investigation_revisions(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES investigation_cases(id),actor_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,snapshot_json TEXT NOT NULL);

INSERT INTO schema_migrations(name) VALUES('017_investigations.sql');

-- 018_templates.sql
ALTER TABLE content_records ADD COLUMN draft_template_json TEXT;
ALTER TABLE content_records ADD COLUMN published_template_json TEXT;

INSERT INTO schema_migrations(name) VALUES('018_templates.sql');

-- 019_cloud_archive_plans.sql
CREATE TABLE archive_operation_plans (
 id TEXT PRIMARY KEY,
 actor_id TEXT NOT NULL REFERENCES users(id),
 storage_key TEXT NOT NULL UNIQUE,
 expires_at INTEGER NOT NULL,
 state TEXT NOT NULL DEFAULT 'READY' CHECK(state IN ('READY','APPLYING'))
);
CREATE INDEX archive_plans_owner_expiry ON archive_operation_plans(actor_id,expires_at);

INSERT INTO schema_migrations(name) VALUES('019_cloud_archive_plans.sql');

-- 020_archive_uploads.sql
CREATE TABLE archive_uploads (
 id TEXT PRIMARY KEY,
 actor_id TEXT NOT NULL REFERENCES users(id),
 storage_key TEXT NOT NULL UNIQUE,
 bytes INTEGER NOT NULL CHECK(bytes>0 AND bytes<=134217728),
 expires_at INTEGER NOT NULL
);
CREATE INDEX archive_uploads_owner_expiry ON archive_uploads(actor_id,expires_at);

INSERT INTO schema_migrations(name) VALUES('020_archive_uploads.sql');

-- Dados canonicos: houses
INSERT OR IGNORE INTO "houses"("id","name","crest","room") VALUES('gryffindor','Grifinória','gryffindor.webp','sala_grifinoria.webp');
INSERT OR IGNORE INTO "houses"("id","name","crest","room") VALUES('hufflepuff','Lufa-Lufa','hufflepuff.webp','sala_lufalufa.webp');
INSERT OR IGNORE INTO "houses"("id","name","crest","room") VALUES('ravenclaw','Corvinal','ravenclaw.webp','sala_corvinal.webp');
INSERT OR IGNORE INTO "houses"("id","name","crest","room") VALUES('slytherin','Sonserina','slytherin.webp','sala_sonserina.webp');

-- Dados canonicos: characters
INSERT OR IGNORE INTO "characters"("id","name","house_id","school_year","biography","photo_id") VALUES('atlas','Atlas Black','gryffindor',NULL,'',NULL);
INSERT OR IGNORE INTO "characters"("id","name","house_id","school_year","biography","photo_id") VALUES('darius','Darius Gaunt','gryffindor',NULL,'',NULL);
INSERT OR IGNORE INTO "characters"("id","name","house_id","school_year","biography","photo_id") VALUES('eiris','Eiris Scamander','hufflepuff',NULL,'',NULL);
INSERT OR IGNORE INTO "characters"("id","name","house_id","school_year","biography","photo_id") VALUES('vane','Vane Grimms','slytherin',NULL,'',NULL);
INSERT OR IGNORE INTO "characters"("id","name","house_id","school_year","biography","photo_id") VALUES('drake','Drake Lovegood','ravenclaw',NULL,'',NULL);

-- Dados canonicos: regions
INSERT OR IGNORE INTO "regions"("id","title","is_open","audience","editorial_policy_json","file_id") VALUES('hogwarts','Hogwarts',1,'ALL',NULL,NULL);
INSERT OR IGNORE INTO "regions"("id","title","is_open","audience","editorial_policy_json","file_id") VALUES('hogsmeade','Hogsmeade',0,'SELECTED',NULL,NULL);

-- Dados canonicos: locations
INSERT OR IGNORE INTO "locations"("id","region_id","title","image","kind","is_secret","enabled","audience","x","y","editorial_policy_json","file_id","destination") VALUES('tomos','hogsmeade','Tomos e Pergaminhos','loja_tomos_pergaminhos.webp','SHOP',0,1,'ALL',36,85,NULL,NULL,'LOCATION');
INSERT OR IGNORE INTO "locations"("id","region_id","title","image","kind","is_secret","enabled","audience","x","y","editorial_policy_json","file_id","destination") VALUES('olivaras','hogsmeade','Olivaras','loja_olivaras.webp','SHOP',0,1,'ALL',61,20,NULL,NULL,'LOCATION');
INSERT OR IGNORE INTO "locations"("id","region_id","title","image","kind","is_secret","enabled","audience","x","y","editorial_policy_json","file_id","destination") VALUES('dedosdemel','hogsmeade','Dedosdemel','loja_dedosdemel.webp','SHOP',0,1,'ALL',49,36,NULL,NULL,'LOCATION');
INSERT OR IGNORE INTO "locations"("id","region_id","title","image","kind","is_secret","enabled","audience","x","y","editorial_policy_json","file_id","destination") VALUES('pippin','hogsmeade','Poções de J. Pippin','loja_pocoes.webp','SHOP',0,1,'ALL',31,50,NULL,NULL,'LOCATION');
INSERT OR IGNORE INTO "locations"("id","region_id","title","image","kind","is_secret","enabled","audience","x","y","editorial_policy_json","file_id","destination") VALUES('biblioteca','hogwarts','Biblioteca de Hogwarts','biblioteca_hogwarts.webp','LIBRARY',0,1,'ALL',NULL,NULL,NULL,NULL,'LOCATION');
COMMIT;
SELECT (SELECT count(*) FROM schema_migrations) AS migrations, (SELECT count(*) FROM houses) AS casas, (SELECT count(*) FROM characters) AS personagens;
