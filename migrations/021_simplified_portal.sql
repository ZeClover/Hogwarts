-- Additive: legacy source tables remain intact for recovery and compatibility.
CREATE TABLE IF NOT EXISTS item_possessions (
 id TEXT PRIMARY KEY, character_id TEXT NOT NULL REFERENCES characters(id),
 item_id TEXT NOT NULL REFERENCES catalog_items(id), quantity INTEGER NOT NULL CHECK(quantity>0),
 source_key TEXT NOT NULL UNIQUE, snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
 actor_id TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE INDEX IF NOT EXISTS possessions_owner ON item_possessions(character_id);
ALTER TABLE purchase_orders ADD COLUMN negotiation TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS legacy_story_missions (
 story_id TEXT PRIMARY KEY REFERENCES personal_story_arcs(id), quest_id TEXT NOT NULL UNIQUE REFERENCES quests(id)
);
INSERT OR IGNORE INTO quests(id,owner_user_id,status,version,draft_json,draft_policy_json,private_json,published_json,published_policy_json,published_revision,published_at,created_at,updated_at)
SELECT id,owner_user_id,status,version,
 json_set(draft_json,'$.kind','Missão individual'),
 draft_policy_json,private_json,
 CASE WHEN published_json IS NOT NULL THEN json_set(published_json,'$.kind','Missão individual','$.objectives',json('[]'),'$.clues',json(COALESCE((SELECT json_group_array(json_set(e.value,'$.policy',json(s.published_policy_json))) FROM json_each(s.published_json,'$.entries') e),'[]'))) END,
 CASE WHEN published_policy_json IS NOT NULL THEN published_policy_json END,
 published_revision,published_at,created_at,updated_at FROM personal_story_arcs s;
INSERT OR IGNORE INTO legacy_story_missions SELECT id,id FROM personal_story_arcs;
INSERT OR IGNORE INTO quest_participants(quest_id,character_id,active,state,released_revision,actor_id,released_at,started_at)
SELECT id,protagonist_id,access_active,'IN_PROGRESS',COALESCE(published_revision,version),owner_user_id,COALESCE(released_at,created_at),released_at FROM personal_story_arcs WHERE released_at IS NOT NULL;
INSERT OR IGNORE INTO quest_clues(id,quest_id,position,draft_json,private_notes)
SELECT e.id,e.arc_id,e.position,json_set(e.draft_json,'$.policy',json(s.draft_policy_json)),e.private_notes FROM personal_story_entries e JOIN personal_story_arcs s ON s.id=e.arc_id;
INSERT OR IGNORE INTO quest_clue_reveals(quest_id,clue_id,character_id,active,snapshot_json,source_revision,actor_id)
SELECT r.arc_id,r.entry_id,r.character_id,r.active,json_set(r.snapshot_json,'$.policy',json(s.published_policy_json)),r.source_revision,r.actor_id FROM personal_story_reveals r JOIN personal_story_arcs s ON s.id=r.arc_id;
INSERT OR IGNORE INTO quest_revisions(record_id,version,actor_id,action,snapshot_json,created_at)
SELECT record_id,version,actor_id,action,snapshot_json,created_at FROM story_revisions;
-- Independent cup cycles do not create school years or advance the calendar.
CREATE TABLE IF NOT EXISTS cup_cycles(id TEXT PRIMARY KEY,label TEXT NOT NULL,command_key TEXT UNIQUE NOT NULL,version INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','CLOSED')),created_at INTEGER NOT NULL DEFAULT(unixepoch()));
CREATE TABLE IF NOT EXISTS cup_cycle_entries(id TEXT PRIMARY KEY,cycle_id TEXT NOT NULL REFERENCES cup_cycles(id),house_id TEXT NOT NULL REFERENCES houses(id),amount INTEGER NOT NULL CHECK(amount!=0 AND abs(amount)<=1000000),reason TEXT NOT NULL,character_id TEXT REFERENCES characters(id),command_key TEXT UNIQUE NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id));
CREATE TABLE IF NOT EXISTS cup_cycle_results(id TEXT PRIMARY KEY,cycle_id TEXT NOT NULL REFERENCES cup_cycles(id),version INTEGER NOT NULL,snapshot_json TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),UNIQUE(cycle_id,version));
