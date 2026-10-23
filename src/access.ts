import { filterAsync, mapAsync, someAsync } from './async-array.ts';
import { contentAllowed, contentPayload } from './content.ts';
import { campaignNews } from './campaign.ts';
import { calendarHeader } from './calendar-model.ts';
import type { DB, Row } from './db.ts';
import { all, one } from './db.ts';
import type { Viewer } from './auth.ts';
import { policyAllows, type Policy } from './editorial.ts';
export async function granted(db: DB, viewer: Viewer, type: string, id: string) {
    if (!viewer.characterId)
        return false;
    return !!await one(db, `SELECT a.id FROM access_grants a WHERE a.resource_type=? AND a.resource_id=?
    AND (a.character_id=? OR a.group_id IN (SELECT group_id FROM group_members WHERE character_id=?)) LIMIT 1`, type, id, viewer.characterId, viewer.characterId);
}
export async function regionVisible(db: DB, viewer: Viewer, region: Row) {
    return viewer.role === 'MASTER' || ((!region.editorial_policy_json || await policyAllows(db, viewer, JSON.parse(String(region.editorial_policy_json)) as Policy)) && !!region.is_open && (region.audience === 'ALL' || await granted(db, viewer, 'REGION', String(region.id))));
}
export async function locationVisible(db: DB, viewer: Viewer, location: Row) {
    if (viewer.role === 'MASTER')
        return true;
    const region = await one(db, 'SELECT * FROM regions WHERE id=?', String(location.region_id));
    return !!region && await regionVisible(db, viewer, region) && !!location.enabled && (!location.editorial_policy_json || await policyAllows(db, viewer, JSON.parse(String(location.editorial_policy_json)) as Policy)) &&
        (await granted(db, viewer, 'LOCATION', String(location.id)) || (!location.is_secret && location.audience === 'ALL'));
}
export async function characterDTO(db: DB, id: string) {
    const row = await one(db, `SELECT c.id,c.name,c.house_id,c.school_year,c.biography,c.photo_id,h.name AS house_name,h.crest,h.room
    FROM characters c JOIN houses h ON h.id=c.house_id WHERE c.id=?`, id);
    if (!row)
        return null;
    return { id: row.id, name: row.name, house: row.house_id, houseName: row.house_name,
        year: row.school_year, biography: row.biography, photo: row.photo_id ? `/api/media/${row.photo_id}` : null,
        crest: `/assets/${row.crest}`, room: `/assets/${row.room}` };
}
export function locationDTO(row: Row) {
    return { id: row.id, title: row.title, regionId: row.region_id, kind: row.kind, image: row.file_id ? `/api/content/places/${row.id}/image` : row.image ? `/assets/${row.image}` : null, x: row.x, y: row.y };
}
export async function publicationVisible(db: DB, viewer: Viewer, row: Row) {
    if (row.status !== 'PUBLISHED' || !row.published_at)
        return false;
    if (viewer.role !== 'MASTER' && row.audience !== 'ALL' && !await granted(db, viewer, 'PUBLICATION', String(row.id)))
        return false;
    if (row.region_id) {
        const region = await one(db, 'SELECT * FROM regions WHERE id=?', row.region_id);
        if (!region || !await regionVisible(db, viewer, region))
            return false;
    }
    if (row.location_id) {
        const location = await one(db, 'SELECT * FROM locations WHERE id=?', row.location_id);
        if (!location || !await locationVisible(db, viewer, location))
            return false;
    }
    return true;
}
export async function mediaVisible(db: DB, viewer: Viewer, media: Row) {
    if (viewer.role === 'MASTER' || media.owner_character_id === viewer.characterId || await granted(db, viewer, 'MEDIA', String(media.id)))
        return true;
    return await someAsync((await all(db, 'SELECT * FROM publications WHERE media_id=?', String(media.id))), async (p) => await publicationVisible(db, viewer, p));
}
async function portalNews(db: DB, viewer: Viewer, currentYear: string) {
    const news = (await filterAsync(await all(db, "SELECT * FROM publications WHERE status='PUBLISHED' ORDER BY published_at DESC"), r => publicationVisible(db, viewer, r))).map(r => ({ id: String(r.id), title: String(r.title), kind: String(r.kind), href: '/portal/publicacao/' + r.id, order: Number(r.published_at) }));
    for (const r of await all(db, "SELECT r.*,COALESCE(pub.created_at,r.created_at) AS publication_order FROM content_records r LEFT JOIN content_revisions pub ON pub.record_id=r.id AND pub.version=r.published_revision WHERE kind IN ('newspapers','events','notices') AND status='PUBLISHED' ORDER BY publication_order DESC,r.id")) {
        if (!await contentAllowed(db, viewer, r)) continue;
        const p = contentPayload(r);
        if (r.kind === 'events' && p.academicYear !== currentYear) continue;
        news.push({ id: String(r.id), title: String(p.title), kind: String(r.kind), href: '/portal/conteudos/' + r.kind + '/' + r.id, order: Number(r.publication_order) });
    }
    news.push(...await campaignNews(db, viewer));
    // Technical timestamps only sort records. They are not narrative dates.
    return news.sort((a,b) => b.order-a.order || a.id.localeCompare(b.id)).map(({id,title,kind,href}) => ({id,title,kind,href}));
}
export async function portalState(db: DB, viewer: Viewer) {
    const calendar = await calendarHeader(db);
    const regions = await mapAsync((await filterAsync((await all(db, 'SELECT * FROM regions')), async (r) => await regionVisible(db, viewer, r))), async (r) => ({ id: r.id, title: r.title, accessible: await regionVisible(db, viewer, r) }));
    return {
        role: viewer.role, preview: viewer.preview, calendar,
        character: viewer.characterId ? await characterDTO(db, viewer.characterId) : null,
        regions,
        locations: (await filterAsync((await all(db, 'SELECT * FROM locations')), async (r) => await locationVisible(db, viewer, r))).map(locationDTO),
        news: await portalNews(db, viewer, calendar.academicYear),
    };
}
