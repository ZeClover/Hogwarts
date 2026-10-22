import { forEachAsync } from './async-array.ts';
import { knownAcademicYear } from './calendar-model.ts';
import { randomUUID } from 'node:crypto';
import type { DB, Row } from './db.ts';
import { one, all, audit, transaction } from './db.ts';
import { fail, now, digest, type Session, type Viewer } from './auth.ts';
import { fields, record, stringIds, text } from './http.ts';
import { regionVisible, locationVisible } from './access.ts';
export type Policy = {
    audience: 'ALL' | 'SELECTED';
    characters: string[];
    groups: string[];
    houses: string[];
    schoolYears: number[];
    cohorts: string[];
    excludedCharacters: string[];
    regionId: string | null;
    locationId: string | null;
};
export type MediaPayload = {
    title: string;
    description: string;
    alt: string;
    category: string;
    credit: string;
    academicYear: string;
    fileId: string;
    presentation: string;
    crop: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
};
export const categories = ['SCENERY', 'CREST', 'OBJECT', 'DOCUMENT', 'OTHER'];
export const presentations = ['SCENE', 'PORTRAIT', 'COVER', 'CARD'];
export async function exists(db: DB, table: 'characters' | 'access_groups' | 'houses' | 'school_cohorts' | 'regions' | 'locations' | 'workshop_files', id: string) {
    if (!await one(db, `SELECT id FROM ${table} WHERE id=?`, id))
        fail(400, 'A seleção contém um registro indisponível.');
}
export async function validatePolicy(db: DB, value: unknown): Promise<Policy> {
    const data = record(value);
    fields(data, ['audience', 'characters', 'groups', 'houses', 'schoolYears', 'cohorts', 'excludedCharacters', 'regionId', 'locationId']);
    if (data.audience !== 'ALL' && data.audience !== 'SELECTED')
        fail(400, 'Escolha os destinatários.');
    const characters = stringIds(data.characters), groups = stringIds(data.groups), houses = stringIds(data.houses);
    const cohorts = stringIds(data.cohorts), excludedCharacters = stringIds(data.excludedCharacters);
    for (const [table, values] of [['characters', characters], ['access_groups', groups], ['houses', houses], ['school_cohorts', cohorts], ['characters', excludedCharacters]] as const)
        await forEachAsync(values, async (id) => await exists(db, table, id));
    if (!Array.isArray(data.schoolYears) || data.schoolYears.length > 7 || data.schoolYears.some(y => !Number.isInteger(y) || y < 1 || y > 7))
        fail(400, 'Ano escolar inválido.');
    const regionId = data.regionId === null ? null : text(data.regionId, 100), locationId = data.locationId === null ? null : text(data.locationId, 100);
    if (regionId)
        await exists(db, 'regions', regionId);
    if (locationId)
        await exists(db, 'locations', locationId);
    return { audience: data.audience, characters, groups, houses, cohorts, excludedCharacters, schoolYears: [...new Set(data.schoolYears as number[])], regionId, locationId };
}
export async function policyAllows(db: DB, viewer: Viewer, policy: Policy): Promise<boolean> {
    if (!viewer.characterId)
        return false;
    const id = viewer.characterId, character = await one(db, 'SELECT house_id,school_year FROM characters WHERE id=?', id);
    if (!character || policy.excludedCharacters.includes(id))
        return false;
    if (policy.houses.length && !policy.houses.includes(String(character.house_id)))
        return false;
    if (policy.schoolYears.length && !policy.schoolYears.includes(Number(character.school_year)))
        return false;
    if (policy.cohorts.length && !(await all(db, 'SELECT cohort_id FROM cohort_members WHERE character_id=?', id)).some(r => policy.cohorts.includes(String(r.cohort_id))))
        return false;
    if (policy.regionId) {
        const region = await one(db, 'SELECT * FROM regions WHERE id=?', policy.regionId);
        if (!region || !await regionVisible(db, viewer, region))
            return false;
    }
    if (policy.locationId) {
        const location = await one(db, 'SELECT * FROM locations WHERE id=?', policy.locationId);
        if (!location || !await locationVisible(db, viewer, location))
            return false;
    }
    return policy.audience === 'ALL' || policy.characters.includes(id) || (await all(db, 'SELECT group_id FROM group_members WHERE character_id=?', id)).some(r => policy.groups.includes(String(r.group_id)));
}
export async function validatePayload(db: DB, value: unknown): Promise<MediaPayload> {
    const data = record(value);
    fields(data, ['title', 'description', 'alt', 'category', 'credit', 'academicYear', 'fileId', 'presentation', 'crop']);
    const fileId = text(data.fileId, 100);
    await exists(db, 'workshop_files', fileId);
    const crop = record(data.crop);
    fields(crop, ['x', 'y', 'width', 'height']);
    const coordinate = (v: unknown, min: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= 100 ? v : fail(400, 'Corte inválido. Use percentuais entre 0 e 100.');
    const x = coordinate(crop.x, 0), y = coordinate(crop.y, 0), width = coordinate(crop.width, 0.1), height = coordinate(crop.height, 0.1);
    if (x + width > 100 || y + height > 100)
        fail(400, 'O corte ultrapassa a imagem.');
    if (!categories.includes(String(data.category)) || !presentations.includes(String(data.presentation)))
        fail(400, 'Categoria ou apresentação inválida.');
    if (!await knownAcademicYear(db, data.academicYear))
        fail(400, 'Selecione o ano letivo disponível.');
    return { title: text(data.title, 120), description: text(data.description, 3000, false), alt: text(data.alt, 300, false), credit: text(data.credit, 300, false),
        category: String(data.category), presentation: String(data.presentation), academicYear: String(data.academicYear), fileId, crop: { x, y, width, height } };
}
export async function entry(db: DB, id: string): Promise<Row> {
    return await one(db, 'SELECT * FROM editorial_entries WHERE id=?', id) ?? fail(404, 'Registro não encontrado.');
}
export function draft(row: Row): MediaPayload { return JSON.parse(String(row.draft_json)) as MediaPayload; }
export function policy(row: Row, published = false): Policy { return JSON.parse(String(published ? row.published_policy_json : row.draft_policy_json)) as Policy; }
export function published(row: Row): MediaPayload { return JSON.parse(String(row.published_json)) as MediaPayload; }
export function imageStamp(row: Row) { return digest(`${row.id}:${row.published_revision}`).slice(0, 20); }
export function publicMedia(row: Row, payload: MediaPayload = published(row), image?: string) {
    return { id: row.id, title: payload.title, description: payload.description, alt: payload.alt, category: payload.category,
        credit: payload.credit, academicYear: payload.academicYear, presentation: payload.presentation,
        image: image ?? `/api/workshop/media/${row.id}/image?stamp=${imageStamp(row)}` };
}
export async function adminMedia(db: DB, row: Row) {
    const payload = draft(row), file = await one(db, 'SELECT id,width,height,origin_asset FROM workshop_files WHERE id=?', payload.fileId);
    return { id: row.id, status: row.status, version: row.version, payload, policy: policy(row), privateNotes: row.private_notes,
        hasUnpublishedChanges: !!row.published_revision && row.published_revision !== row.version,
        publishedRevision: row.published_revision, updatedAt: row.updated_at,
        file: file ? { id: file.id, width: file.width, height: file.height, originalAlreadyPublic: !!file.origin_asset,
            image: `/api/master/workshop/files/${file.id}` } : null };
}
function snapshot(row: Row) {
    return { status: row.status, version: row.version, payload: draft(row), policy: policy(row), privateNotes: row.private_notes,
        published: row.published_json ? published(row) : null, publishedPolicy: row.published_policy_json ? policy(row, true) : null, publishedRevision: row.published_revision };
}
async function revision(db: DB, row: Row, actor: Session, action: string) {
    await db.prepare('INSERT INTO editorial_revisions(entry_id,version,actor_id,action,snapshot_json) VALUES(?,?,?,?,?)')
        .run(String(row.id), Number(row.version), actor.userId, action, JSON.stringify(snapshot(row)));
    await audit(db, actor.userId, `EDITORIAL_${action}`, 'MEDIA', String(row.id), { version: row.version });
}
export async function createEntry(db: DB, actor: Session, data: Record<string, unknown>) {
    fields(data, ['payload', 'policy', 'privateNotes']);
    const payload = await validatePayload(db, data.payload), audience = await validatePolicy(db, data.policy), notes = text(data.privateNotes ?? '', 5000, false), id = randomUUID();
    return await transaction(db, async () => {
        await db.prepare('INSERT INTO editorial_entries(id,owner_user_id,draft_json,draft_policy_json,private_notes) VALUES(?,?,?,?,?)')
            .run(id, actor.userId, JSON.stringify(payload), JSON.stringify(audience), notes);
        const row = await entry(db, id);
        await revision(db, row, actor, 'CREATED');
        return await adminMedia(db, row);
    });
}
export function expected(row: Row, value: unknown) {
    if (!Number.isInteger(value) || value !== row.version)
        fail(409, 'Este registro mudou em outra sessão. Recarregue antes de salvar.');
}
export async function editEntry(db: DB, actor: Session, id: string, data: Record<string, unknown>) {
    fields(data, ['version', 'payload', 'policy', 'privateNotes']);
    const payload = await validatePayload(db, data.payload), audience = await validatePolicy(db, data.policy), notes = text(data.privateNotes ?? '', 5000, false);
    return await transaction(db, async () => {
        const before = await entry(db, id);
        expected(before, data.version);
        if (before.status === 'ARCHIVED')
            fail(409, 'Restaure o registro antes de editar.');
        await db.prepare("UPDATE editorial_entries SET draft_json=?,draft_policy_json=?,private_notes=?,version=version+1,status=CASE WHEN status='PREPARED' THEN 'DRAFT' ELSE status END,updated_at=? WHERE id=?")
            .run(JSON.stringify(payload), JSON.stringify(audience), notes, now(), id);
        const row = await entry(db, id);
        await revision(db, row, actor, 'SAVED');
        return await adminMedia(db, row);
    });
}
export async function command(db: DB, actor: Session, id: string, action: string, data: Record<string, unknown>) {
    fields(data, ['version']);
    return await transaction(db, async () => {
        const before = await entry(db, id);
        expected(before, data.version);
        if (action === 'duplicate') {
            const payload = draft(before);
            payload.title = `${payload.title.slice(0, 110)} — cópia`;
            // Nested service operations use this same transaction, so create the copy directly.
            const copyId = randomUUID();
            await db.prepare('INSERT INTO editorial_entries(id,owner_user_id,draft_json,draft_policy_json,private_notes) VALUES(?,?,?,?,?)')
                .run(copyId, actor.userId, JSON.stringify(payload), String(before.draft_policy_json), String(before.private_notes));
            const copy = await entry(db, copyId);
            await revision(db, copy, actor, 'DUPLICATED');
            return await adminMedia(db, copy);
        }
        if (action === 'restore') {
            if (before.status !== 'ARCHIVED')
                fail(409, 'Somente registros arquivados podem ser restaurados.');
            await db.prepare('UPDATE editorial_entries SET status=?,version=version+1,updated_at=? WHERE id=?').run(draft(before).alt ? 'PREPARED' : 'DRAFT', now(), id);
        }
        else if (action === 'archive') {
            if (before.status === 'ARCHIVED')
                fail(409, 'O registro já está arquivado.');
            await db.prepare("UPDATE editorial_entries SET status='ARCHIVED',version=version+1,updated_at=? WHERE id=?").run(now(), id);
        }
        else if (action === 'prepare' || action === 'publish') {
            if (before.status === 'ARCHIVED')
                fail(409, 'Restaure o registro antes de preparar ou publicar.');
            const payload = draft(before);
            if (!payload.alt)
                fail(422, 'Preencha o texto alternativo antes de preparar ou publicar.');
            if (action === 'publish')
                await db.prepare("UPDATE editorial_entries SET status='PUBLISHED',version=version+1,published_json=draft_json,published_policy_json=draft_policy_json,published_revision=version+1,published_at=?,updated_at=? WHERE id=?").run(now(), now(), id);
            else {
                if (before.status === 'PUBLISHED')
                    fail(409, 'O registro já tem uma revisão publicada. Salve alterações como rascunho.');
                await db.prepare('UPDATE editorial_entries SET status=?,version=version+1,updated_at=? WHERE id=?').run(draft(before).alt ? 'PREPARED' : 'DRAFT', now(), id);
            }
        }
        else
            fail(404, 'Ação não encontrada.');
        const row = await entry(db, id);
        await revision(db, row, actor, action.toUpperCase());
        return await adminMedia(db, row);
    });
}
