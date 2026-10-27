import { filterAsync, flatMapAsync, forEachAsync } from './async-array.ts';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Config } from './config.ts';
import { all, one, audit, transaction, type DB, type Row } from './db.ts';
import { fail, now, requireMaster, requireSession, viewerFor, type Session, type Viewer } from './auth.ts';
import { fields, jsonBody, record, send, text, stringIds } from './http.ts';
import { exists, expected, validatePolicy, policyAllows, imageStamp, type Policy } from './editorial.ts';
import { locationVisible } from './access.ts';
import { renderImage } from './workshop.ts';
export const npcRoles = ['PROFESSOR', 'MERCHANT', 'STUDENT', 'OTHER'];
type Fragment = {
    id: string;
    title: string;
    text: string;
    policy: Policy;
};
type NPCPayload = {
    name: string;
    description: string;
    role: string;
    houseId: string | null;
    locationId: string | null;
    relatedLocations: string[];
    portraitFileId: string | null;
    portraitAlt: string;
    fragments: Fragment[];
};
const getNPC = async (db: DB, id: string) => await one(db, 'SELECT * FROM npcs WHERE id=?', id) ?? fail(404, 'Pessoa não encontrada.');
const dataOf = (row: Row, published = false): NPCPayload => JSON.parse(String(published ? row.published_json : row.draft_json));
const policyOf = (row: Row, published = false): Policy => JSON.parse(String(published ? row.published_policy_json : row.draft_policy_json));
const reveals = async (db: DB, id: string) => await all(db, 'SELECT * FROM npc_reveals WHERE npc_id=? ORDER BY fragment_id,character_id', id);
async function validateBase(db: DB, value: unknown, fragments: Fragment[]): Promise<NPCPayload> {
    const data = record(value);
    fields(data, ['name', 'description', 'role', 'houseId', 'locationId', 'relatedLocations', 'portraitFileId', 'portraitAlt']);
    if (!npcRoles.includes(String(data.role)))
        fail(400, 'Escolha o papel do NPC.');
    const optional = async (value: unknown, table: 'houses' | 'locations' | 'workshop_files') => {
        if (value === null)
            return null;
        const id = text(value, 100);
        await exists(db, table, id);
        return id;
    };
    const relatedLocations = stringIds(data.relatedLocations);
    await forEachAsync(relatedLocations, async (id) => await exists(db, 'locations', id));
    return { name: text(data.name, 120), description: text(data.description, 3000, false), role: String(data.role),
        houseId: await optional(data.houseId, 'houses'), locationId: await optional(data.locationId, 'locations'), relatedLocations,
        portraitFileId: await optional(data.portraitFileId, 'workshop_files'), portraitAlt: text(data.portraitAlt, 300, false), fragments };
}
function ready(payload: NPCPayload) {
    if (payload.portraitFileId && !payload.portraitAlt)
        fail(422, 'Preencha o texto alternativo do retrato antes de preparar ou publicar.');
}
function pending(row: Row) { return !!row.published_json && (row.draft_json !== row.published_json || row.draft_policy_json !== row.published_policy_json); }
async function snapshot(db: DB, row: Row) {
    return { status: row.status, version: row.version, payload: dataOf(row), policy: policyOf(row), privateNotes: row.private_notes,
        published: row.published_json ? dataOf(row, true) : null, publishedPolicy: row.published_policy_json ? policyOf(row, true) : null,
        publishedRevision: row.published_revision, reveals: (await reveals(db, String(row.id))).map(r => ({ fragmentId: r.fragment_id, characterId: r.character_id, active: !!r.active,
            content: JSON.parse(String(r.snapshot_json)), sourceRevision: r.source_revision })) };
}
async function revision(db: DB, row: Row, actor: Session, action: string) {
    await db.prepare('INSERT INTO npc_revisions(npc_id,version,actor_id,action,snapshot_json) VALUES(?,?,?,?,?)')
        .run(String(row.id), Number(row.version), actor.userId, action, JSON.stringify(await snapshot(db, row)));
    await audit(db, actor.userId, `NPC_${action}`, 'NPC', String(row.id), { version: row.version });
}
async function administrative(db: DB, row: Row) {
    const payload = dataOf(row), file = payload.portraitFileId ? await one(db, 'SELECT id,width,height,origin_asset FROM workshop_files WHERE id=?', payload.portraitFileId) : null;
    return { id: row.id, status: row.status, version: row.version, payload, policy: policyOf(row), privateNotes: row.private_notes,
        hasUnpublishedChanges: pending(row), publishedRevision: row.published_revision,
        publishedFragmentIds: row.published_json ? dataOf(row, true).fragments.map(f => f.id) : [],
        portraitFile: file ? { id: file.id, image: `/api/master/workshop/files/${file.id}`, originalAlreadyPublic: !!file.origin_asset } : null,
        reveals: (await reveals(db, String(row.id))).map(r => ({ fragmentId: r.fragment_id, characterId: r.character_id, active: !!r.active, sourceRevision: r.source_revision })) };
}
async function canRead(db: DB, viewer: Viewer, row: Row) { return row.status === 'PUBLISHED' && !!row.published_json && (viewer.role === 'MASTER' || await policyAllows(db, viewer, policyOf(row, true))); }
export async function projectNPC(db: DB, viewer: Viewer, row: Row, draft = false, portraitURL?: string) {
    const payload = dataOf(row, !draft), locationIds = [...new Set([payload.locationId, ...payload.relatedLocations].filter((id): id is string => !!id))];
    const locations = await flatMapAsync(locationIds, async (id) => {
        const location = await one(db, 'SELECT * FROM locations WHERE id=?', id);
        return location && await locationVisible(db, viewer, location) ? [{ id: location.id, title: location.title }] : [];
    });
    const availableFragments = await flatMapAsync(payload.fragments, async (fragment) => {
        if (!viewer.characterId || !await policyAllows(db, viewer, fragment.policy))
            return [];
        const revealed = await one(db, 'SELECT snapshot_json FROM npc_reveals WHERE npc_id=? AND fragment_id=? AND character_id=? AND active=1', String(row.id), fragment.id, viewer.characterId);
        return revealed ? [{ id: fragment.id, ...JSON.parse(String(revealed.snapshot_json)) as {
                    title: string;
                    text: string;
                } }] : [];
    });
    return { id: row.id, name: payload.name, description: payload.description, role: payload.role,
        house: payload.houseId ? (await one(db, 'SELECT name FROM houses WHERE id=?', payload.houseId))?.name ?? null : null,
        locations, fragments: availableFragments,
        portrait: payload.portraitFileId ? (portraitURL ?? `/api/workshop/npcs/${row.id}/portrait?stamp=${imageStamp(row)}`) : null,
        portraitAlt: payload.portraitFileId ? payload.portraitAlt : '' };
}
export async function npcReference(db: DB, viewer: Viewer, id: string) {
    const row = await one(db, 'SELECT * FROM npcs WHERE id=?', id);
    if (!row || !await canRead(db, viewer, row))
        return null;
    const p = dataOf(row, true);
    return { id: row.id, name: p.name, role: p.role };
}
export async function npcReferencesForLocation(db: DB, viewer: Viewer, locationId: string) {
    const location = await one(db, 'SELECT * FROM locations WHERE id=?', locationId);
    if (!location || !await locationVisible(db, viewer, location))
        return [];
    return (await filterAsync((await all(db, 'SELECT n.* FROM npcs n JOIN npc_location_links l ON l.npc_id=n.id WHERE l.location_id=? ORDER BY n.id', locationId)), async (row) => await canRead(db, viewer, row))).map(row => { const p = dataOf(row, true); return { id: row.id, name: p.name, role: p.role }; });
}
async function createNPC(db: DB, actor: Session, data: Record<string, unknown>) {
    fields(data, ['payload', 'policy', 'privateNotes']);
    const payload = await validateBase(db, data.payload, []), audience = await validatePolicy(db, data.policy), notes = text(data.privateNotes ?? '', 5000, false), id = randomUUID();
    return await transaction(db, async () => {
        await db.prepare('INSERT INTO npcs(id,owner_user_id,draft_json,draft_policy_json,private_notes) VALUES(?,?,?,?,?)').run(id, actor.userId, JSON.stringify(payload), JSON.stringify(audience), notes);
        const row = await getNPC(db, id);
        await revision(db, row, actor, 'CREATED');
        return await administrative(db, row);
    });
}
async function saveNPC(db: DB, actor: Session, id: string, data: Record<string, unknown>) {
    fields(data, ['version', 'payload', 'policy', 'privateNotes']);
    return await transaction(db, async () => {
        const before = await getNPC(db, id);
        expected(before, data.version);
        if (before.status === 'ARCHIVED')
            fail(409, 'Restaure o NPC antes de editar.');
        const payload = await validateBase(db, data.payload, dataOf(before).fragments), audience = await validatePolicy(db, data.policy), notes = text(data.privateNotes ?? '', 5000, false);
        await db.prepare("UPDATE npcs SET draft_json=?,draft_policy_json=?,private_notes=?,version=version+1,status=CASE WHEN status='PREPARED' THEN 'DRAFT' ELSE status END,updated_at=? WHERE id=?")
            .run(JSON.stringify(payload), JSON.stringify(audience), notes, now(), id);
        const row = await getNPC(db, id);
        await revision(db, row, actor, 'SAVED');
        return await administrative(db, row);
    });
}
async function saveFragment(db: DB, actor: Session, id: string, data: Record<string, unknown>, remove = false) {
    fields(data, remove ? ['version', 'fragmentId'] : ['version', 'fragmentId', 'title', 'text', 'policy']);
    return await transaction(db, async () => {
        const before = await getNPC(db, id);
        expected(before, data.version);
        if (before.status === 'ARCHIVED')
            fail(409, 'Restaure o NPC antes de editar.');
        const payload = dataOf(before), fragmentId = data.fragmentId === null ? randomUUID() : text(data.fragmentId, 100);
        const previous = payload.fragments.find(f => f.id === fragmentId);
        if ((remove || data.fragmentId !== null) && !previous)
            fail(404, 'Informação não encontrada.');
        if (remove)
            payload.fragments = payload.fragments.filter(f => f.id !== fragmentId);
        else {
            const fragment = { id: fragmentId, title: text(data.title, 120), text: text(data.text, 4000), policy: await validatePolicy(db, data.policy) };
            if (previous)
                payload.fragments = payload.fragments.map(f => f.id === fragmentId ? fragment : f);
            else {
                if (payload.fragments.length >= 30)
                    fail(400, 'Use até 30 informações por NPC.');
                payload.fragments.push(fragment);
            }
        }
        await db.prepare("UPDATE npcs SET draft_json=?,version=version+1,status=CASE WHEN status='PREPARED' THEN 'DRAFT' ELSE status END,updated_at=? WHERE id=?").run(JSON.stringify(payload), now(), id);
        const row = await getNPC(db, id);
        await revision(db, row, actor, remove ? 'FRAGMENT_REMOVED' : 'FRAGMENT_SAVED');
        return await administrative(db, row);
    });
}
async function npcCommand(db: DB, actor: Session, id: string, action: string, data: Record<string, unknown>) {
    fields(data, ['version']);
    return await transaction(db, async () => {
        const before = await getNPC(db, id);
        expected(before, data.version);
        const payload = dataOf(before);
        if (action === 'duplicate') {
            const copyId = randomUUID();
            payload.name = `${payload.name.slice(0, 110)} — cópia`;
            payload.fragments = payload.fragments.map(f => ({ ...f, id: randomUUID() }));
            await db.prepare('INSERT INTO npcs(id,owner_user_id,draft_json,draft_policy_json,private_notes) VALUES(?,?,?,?,?)')
                .run(copyId, actor.userId, JSON.stringify(payload), String(before.draft_policy_json), String(before.private_notes));
            const row = await getNPC(db, copyId);
            await revision(db, row, actor, 'DUPLICATED');
            return await administrative(db, row);
        }
        if (action === 'archive') {
            if (before.status === 'ARCHIVED')
                fail(409, 'O NPC já está arquivado.');
            await db.prepare("UPDATE npcs SET status='ARCHIVED',version=version+1,updated_at=? WHERE id=?").run(now(), id);
        }
        else if (action === 'restore') {
            if (before.status !== 'ARCHIVED')
                fail(409, 'Somente um NPC arquivado pode ser restaurado.');
            await db.prepare("UPDATE npcs SET status='DRAFT',version=version+1,updated_at=? WHERE id=?").run(now(), id);
        }
        else if (action === 'prepare' || action === 'publish') {
            if (before.status === 'ARCHIVED')
                fail(409, 'Restaure o NPC antes de publicar.');
            ready(payload);
            if (action === 'prepare') {
                if (before.status === 'PUBLISHED')
                    fail(409, 'Salve as alterações como rascunho antes de republicar.');
                await db.prepare("UPDATE npcs SET status='PREPARED',version=version+1,updated_at=? WHERE id=?").run(now(), id);
            }
            else {
                await db.prepare("UPDATE npcs SET status='PUBLISHED',version=version+1,published_json=draft_json,published_policy_json=draft_policy_json,published_revision=version+1,published_at=?,updated_at=? WHERE id=?").run(now(), now(), id);
                await db.prepare('DELETE FROM npc_location_links WHERE npc_id=?').run(id);
                for (const location of new Set([payload.locationId, ...payload.relatedLocations].filter((v): v is string => !!v)))
                    await db.prepare('INSERT INTO npc_location_links(npc_id,location_id) VALUES(?,?)').run(id, location);
            }
        }
        else
            fail(404, 'Ação não encontrada.');
        const row = await getNPC(db, id);
        await revision(db, row, actor, action.toUpperCase());
        return await administrative(db, row);
    });
}
async function revealFragment(db: DB, actor: Session, id: string, data: Record<string, unknown>, revoke = false) {
    fields(data, ['version', 'fragmentId', 'characters']);
    const characters = stringIds(data.characters);
    if (!characters.length)
        fail(400, 'Escolha ao menos um personagem.');
    await forEachAsync(characters, async (c) => await exists(db, 'characters', c));
    const fragmentId = text(data.fragmentId, 100);
    return await transaction(db, async () => {
        const before = await getNPC(db, id);
        expected(before, data.version);
        if (before.status !== 'PUBLISHED' || !before.published_json)
            fail(409, 'Publique o NPC antes de revelar ou revogar uma informação.');
        const fragment = dataOf(before, true).fragments.find(f => f.id === fragmentId) ?? fail(404, 'Informação publicada não encontrada.');
        if (!revoke)
            for (const characterId of characters) {
                const viewer: Viewer = { userId: actor.userId, role: 'PLAYER', characterId, preview: true };
                if (!await canRead(db, viewer, before) || !await policyAllows(db, viewer, fragment.policy))
                    fail(422, 'Um destinatário não tem acesso ao NPC ou a essa informação. Nenhuma alteração foi aplicada.');
            }
        for (const character of characters) {
            if (revoke)
                await db.prepare('UPDATE npc_reveals SET active=0,actor_id=?,updated_at=? WHERE npc_id=? AND fragment_id=? AND character_id=?').run(actor.userId, now(), id, fragmentId, character);
            else
                await db.prepare(`INSERT INTO npc_reveals(npc_id,fragment_id,character_id,snapshot_json,source_revision,actor_id) VALUES(?,?,?,?,?,?)
        ON CONFLICT(npc_id,fragment_id,character_id) DO UPDATE SET active=1,snapshot_json=excluded.snapshot_json,source_revision=excluded.source_revision,actor_id=excluded.actor_id,updated_at=unixepoch()`)
                    .run(id, fragmentId, character, JSON.stringify({ title: fragment.title, text: fragment.text }), Number(before.published_revision), actor.userId);
        }
        await db.prepare('UPDATE npcs SET version=version+1,updated_at=? WHERE id=?').run(now(), id);
        const row = await getNPC(db, id);
        await revision(db, row, actor, revoke ? 'FRAGMENT_REVOKED' : 'FRAGMENT_REVEALED');
        return await administrative(db, row);
    });
}
async function listNPCs(db: DB, url: URL, viewer?: Viewer) {
    const q = (url.searchParams.get('q') ?? '').trim().toLocaleLowerCase('pt-BR').slice(0, 120), role = url.searchParams.get('role'), status = url.searchParams.get('status');
    const rows = await flatMapAsync((await all(db, 'SELECT * FROM npcs ORDER BY updated_at DESC,id')), async (row) => {
        if (viewer && !await canRead(db, viewer, row))
            return [];
        const value = viewer ? await projectNPC(db, viewer, row) : await administrative(db, row), payload = dataOf(row, !!viewer);
        const searchable = viewer ? `${payload.name} ${payload.description} ${(value as Awaited<ReturnType<typeof projectNPC>>).fragments.map(f => f.text + ' ' + f.title).join(' ')}` : `${payload.name} ${payload.description}`;
        if ((q && !searchable.toLocaleLowerCase('pt-BR').includes(q)) || (role && payload.role !== role) || (!viewer && status && row.status !== status))
            return [];
        return [value];
    });
    const requested = Number(url.searchParams.get('page') ?? 1), page = Number.isInteger(requested) && requested > 0 && requested <= 1000000 ? requested : 1;
    return { items: rows.slice((page - 1) * 12, page * 12), total: rows.length, page, pageSize: 12 };
}
async function portrait(db: DB, config: Config, res: ServerResponse, payload: NPCPayload) {
    if (!payload.portraitFileId)
        fail(404, 'Retrato não encontrado.');
    await renderImage(db, config, res, { fileId: payload.portraitFileId, crop: { x: 0, y: 0, width: 100, height: 100 } }, false);
}
export async function handleNPCs(req: IncomingMessage, res: ServerResponse, url: URL, db: DB, config: Config, session?: Session): Promise<boolean> {
    const path = url.pathname, method = req.method ?? 'GET', admin = path.startsWith('/api/master/workshop/npcs');
    if (!admin && !path.startsWith('/api/workshop/npcs'))
        return false;
    if (admin) {
        const actor = requireMaster(session);
        if (url.searchParams.has('view_as'))
            fail(403, 'Saia da visualização para administrar.');
        if (path === '/api/master/workshop/npcs/references' && method === 'GET') {
            const list = await listNPCs(db, url);
            send(res, 200, { ...list, items: list.items.map(n => ({ id: n.id, name: 'payload' in n ? n.payload.name : n.name, status: 'status' in n ? n.status : null })) });
            return true;
        }
        if (path === '/api/master/workshop/npcs') {
            if (method === 'GET') {
                send(res, 200, await listNPCs(db, url));
                return true;
            }
            if (method === 'POST') {
                send(res, 201, await createNPC(db, actor, await jsonBody(req)));
                return true;
            }
        }
        const match = path.match(/^\/api\/master\/workshop\/npcs\/([\w-]+)(?:\/(history|preview|preview-portrait|fragments|prepare|publish|archive|restore|duplicate|reveal|revoke))?$/);
        if (match) {
            const id = match[1]!, action = match[2], row = await getNPC(db, id);
            if (!action && method === 'GET') {
                send(res, 200, await administrative(db, row));
                return true;
            }
            if (!action && method === 'PATCH') {
                send(res, 200, await saveNPC(db, actor, id, await jsonBody(req)));
                return true;
            }
            if (action === 'history' && method === 'GET') {
                const page = Math.max(1, Math.min(100000, Number(url.searchParams.get('page') ?? 1) || 1));
                send(res, 200, { items: (await all(db, 'SELECT version,actor_id,action,snapshot_json,created_at FROM npc_revisions WHERE npc_id=? ORDER BY version DESC LIMIT 20 OFFSET ?', id, Math.floor(page - 1) * 20)).map(r => ({ version: r.version, actorId: r.actor_id, action: r.action, createdAt: r.created_at, snapshot: JSON.parse(String(r.snapshot_json)) })) });
                return true;
            }
            if ((action === 'preview' || action === 'preview-portrait') && method === 'GET') {
                const characterId = text(url.searchParams.get('character'), 100);
                await exists(db, 'characters', characterId);
                const source = url.searchParams.get('source') ?? 'draft';
                if (!['draft', 'published'].includes(source))
                    fail(400, 'Prévia inválida.');
                const viewer: Viewer = { userId: actor.userId, role: 'PLAYER', characterId, preview: true }, isDraft = source === 'draft';
                const allowed = isDraft ? row.status !== 'ARCHIVED' && await policyAllows(db, viewer, policyOf(row)) : await canRead(db, viewer, row);
                const image = `/api/master/workshop/npcs/${id}/preview-portrait?character=${encodeURIComponent(characterId)}&source=${source}&version=${row.version}`;
                if (action === 'preview') {
                    send(res, 200, { accessible: allowed, preview: true, npc: allowed ? await projectNPC(db, viewer, row, isDraft, image) : null });
                    return true;
                }
                if (!allowed || String(row.version) !== url.searchParams.get('version'))
                    fail(404, 'Retrato não encontrado.');
                await portrait(db, config, res, dataOf(row, !isDraft));
                return true;
            }
            if (action === 'fragments' && ['POST', 'DELETE'].includes(method)) {
                send(res, 200, await saveFragment(db, actor, id, await jsonBody(req), method === 'DELETE'));
                return true;
            }
            if ((action === 'reveal' || action === 'revoke') && method === 'POST') {
                send(res, 200, await revealFragment(db, actor, id, await jsonBody(req), action === 'revoke'));
                return true;
            }
            if (action && ['prepare', 'publish', 'archive', 'restore', 'duplicate'].includes(action) && method === 'POST') {
                send(res, 200, await npcCommand(db, actor, id, action, await jsonBody(req)));
                return true;
            }
        }
        fail(404, 'Recurso não encontrado.');
    }
    const viewer = await viewerFor(db, requireSession(session), url);
    if (path === '/api/workshop/npcs/references' && method === 'GET') {
        const locationId = url.searchParams.get('locationId');
        if (locationId) {
            const location = await one(db, 'SELECT * FROM locations WHERE id=?', locationId);
            if (!location || !await locationVisible(db, viewer, location))
                fail(404, 'Local não encontrado.');
            send(res, 200, { items: await npcReferencesForLocation(db, viewer, locationId) });
            return true;
        }
        const list = await listNPCs(db, url, viewer);
        send(res, 200, { ...list, items: list.items.map(n => ({ id: n.id, name: 'name' in n ? n.name : n.payload.name, role: 'role' in n ? n.role : n.payload.role })) });
        return true;
    }
    if (path === '/api/workshop/npcs' && method === 'GET') {
        send(res, 200, await listNPCs(db, url, viewer));
        return true;
    }
    const match = path.match(/^\/api\/workshop\/npcs\/([\w-]+)(?:\/(portrait))?$/);
    if (match && method === 'GET') {
        const row = await getNPC(db, match[1]!);
        if (!await canRead(db, viewer, row))
            fail(404, 'Pessoa não encontrada.');
        if (match[2]) {
            if (url.searchParams.get('stamp') !== imageStamp(row))
                fail(404, 'Retrato não encontrado.');
            await portrait(db, config, res, dataOf(row, true));
            return true;
        }
        send(res, 200, await projectNPC(db, viewer, row));
        return true;
    }
    fail(404, 'Recurso não encontrado.');
}
