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
