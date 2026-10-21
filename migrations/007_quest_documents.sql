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
