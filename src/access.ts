import type { DB, Row } from './db.ts';
import { all, one } from './db.ts';
import type { Viewer } from './auth.ts';

export function granted(db: DB, viewer: Viewer, type: string, id: string) {
  if (!viewer.characterId) return false;
  return !!one(db, `SELECT a.id FROM access_grants a WHERE a.resource_type=? AND a.resource_id=?
    AND (a.character_id=? OR a.group_id IN (SELECT group_id FROM group_members WHERE character_id=?)) LIMIT 1`,
  type,id,viewer.characterId,viewer.characterId);
}
export function regionVisible(db: DB, viewer: Viewer, region: Row) {
  return viewer.role === 'MASTER' || (!!region.is_open && (region.audience === 'ALL' || granted(db,viewer,'REGION',String(region.id))));
}
export function locationVisible(db: DB, viewer: Viewer, location: Row) {
  if (viewer.role === 'MASTER') return true;
  const region = one(db,'SELECT * FROM regions WHERE id=?',String(location.region_id));
  return !!region && regionVisible(db,viewer,region) && !!location.enabled &&
    (granted(db,viewer,'LOCATION',String(location.id)) || (!location.is_secret && location.audience === 'ALL'));
}
export function characterDTO(db: DB, id: string) {
  const row = one(db,`SELECT c.id,c.name,c.house_id,c.school_year,c.biography,c.photo_id,h.name AS house_name,h.crest,h.room
    FROM characters c JOIN houses h ON h.id=c.house_id WHERE c.id=?`,id);
  if (!row) return null;
  return { id: row.id, name: row.name, house: row.house_id, houseName: row.house_name,
    year: row.school_year, biography: row.biography, photo: row.photo_id ? `/api/media/${row.photo_id}` : null,
    crest: `/assets/${row.crest}`, room: `/assets/${row.room}` };
}
export function locationDTO(row: Row) {
  return { id: row.id, title: row.title, regionId: row.region_id, kind: row.kind, image: `/assets/${row.image}`, x: row.x, y: row.y };
}
export function publicationVisible(db: DB, viewer: Viewer, row: Row) {
  if (row.status !== 'PUBLISHED' || !row.published_at) return false;
  if (viewer.role !== 'MASTER' && row.audience !== 'ALL' && !granted(db,viewer,'PUBLICATION',String(row.id))) return false;
  if (row.region_id) {
    const region = one(db,'SELECT * FROM regions WHERE id=?',row.region_id);
    if (!region || !regionVisible(db,viewer,region)) return false;
  }
  if (row.location_id) {
    const location = one(db,'SELECT * FROM locations WHERE id=?',row.location_id);
    if (!location || !locationVisible(db,viewer,location)) return false;
  }
  return true;
}
export function mediaVisible(db: DB, viewer: Viewer, media: Row) {
  if (viewer.role === 'MASTER' || media.owner_character_id === viewer.characterId || granted(db,viewer,'MEDIA',String(media.id))) return true;
  return all(db,'SELECT * FROM publications WHERE media_id=?',String(media.id)).some(p=>publicationVisible(db,viewer,p));
}
export function portalState(db: DB, viewer: Viewer) {
  const regions = all(db,'SELECT * FROM regions').map(r=>({ id:r.id, title:r.title, accessible:regionVisible(db,viewer,r) }));
  return {
    role: viewer.role, preview: viewer.preview,
    character: viewer.characterId ? characterDTO(db,viewer.characterId) : null,
    regions,
    locations: all(db,'SELECT * FROM locations').filter(r=>locationVisible(db,viewer,r)).map(locationDTO),
    news: all(db,"SELECT * FROM publications WHERE status='PUBLISHED' ORDER BY published_at DESC")
      .filter(r=>publicationVisible(db,viewer,r)).map(r=>({id:r.id,title:r.title,kind:r.kind})),
  };
}
