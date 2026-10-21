CREATE TABLE board_proposals (
 id TEXT PRIMARY KEY,board_id TEXT NOT NULL REFERENCES content_records(id),character_id TEXT NOT NULL REFERENCES characters(id),
 version INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK(status IN('SUBMITTED','APPROVED','REJECTED')),
 draft_json TEXT NOT NULL,approved_record_id TEXT UNIQUE REFERENCES content_records(id),private_reason TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE board_proposal_revisions(proposal_id TEXT NOT NULL REFERENCES board_proposals(id),version INTEGER NOT NULL,snapshot_json TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(proposal_id,version));
