import { filterAsync, mapAsync } from './async-array.ts';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Config } from './config.ts';
import { all, one, audit, transaction, type DB, type Row } from './db.ts';
import { fail, now, requireMaster, requireSession, viewerFor, type Session, type Viewer } from './auth.ts';
import { fields, jsonBody, record, send, text } from './http.ts';
import { exists, expected, validatePolicy, policyAllows, imageStamp, type Policy, type MediaPayload } from './editorial.ts';
import { renderImage } from './workshop.ts';
type ItemPayload = {
    name: string;
    description: string;
    fileId: string | null;
    alt: string;
    crop: MediaPayload['crop'];
};
type Effect = {
    id: string;
    name: string;
    description: string;
    magicDegree: string;
    activation: string;
    uses: string;
    frequency: string;
    requirements: string;
};
type ItemPrivate = {
    category: string;
    quality: string;
    materials: string;
    properties: string;
    magicDegree: string;
    activation: string;
    uses: string;
    frequency: string;
    craftingComplexity: string;
    availability: string;
    rarity: string;
    requirements: string;
    secretText: string;
    notes: string;
    referenceValueNuques: number | null;
    chosenPriceNuques: number | null;
    effects: Effect[];
};
const getItem = async (db: DB, id: string) => await one(db, 'SELECT * FROM catalog_items WHERE id=?', id) ?? fail(404, 'Artigo não encontrado.');
const payloadOf = (row: Row, published = false): ItemPayload => JSON.parse(String(published ? row.published_json : row.draft_json));
const policyOf = (row: Row, published = false): Policy => JSON.parse(String(published ? row.published_policy_json : row.draft_policy_json));
const privateOf = (row: Row): ItemPrivate => JSON.parse(String(row.private_json));
async function validatePayload(db: DB, value: unknown): Promise<ItemPayload> {
    const data = record(value);
    fields(data, ['name', 'description', 'fileId', 'alt', 'crop']);
    const fileId = data.fileId === null ? null : text(data.fileId, 100);
    if (fileId)
        await exists(db, 'workshop_files', fileId);
    const crop = record(data.crop);
    fields(crop, ['x', 'y', 'width', 'height']);
    const coordinate = (v: unknown, min: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= 100 ? v : fail(400, 'Corte inválido. Use percentuais entre 0 e 100.');
    const x = coordinate(crop.x, 0), y = coordinate(crop.y, 0), width = coordinate(crop.width, 0.1), height = coordinate(crop.height, 0.1);
    if (x + width > 100 || y + height > 100)
        fail(400, 'O corte ultrapassa a imagem.');
    return { name: text(data.name, 120), description: text(data.description, 3000, false), fileId, alt: text(data.alt, 300, false), crop: { x, y, width, height } };
}
function validatePrivate(value: unknown, previous: Effect[] = []): ItemPrivate {
    const data = record(value), short = ['category', 'quality', 'magicDegree', 'activation', 'uses', 'frequency', 'craftingComplexity', 'availability', 'rarity', 'requirements'] as const;
    fields(data, [...short, 'materials', 'properties', 'secretText', 'notes', 'referenceValueNuques', 'chosenPriceNuques', 'effects']);
    const money = (value: unknown) => value === null ? null : typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 1000000000000 ? value : fail(400, 'Use um valor inteiro e não negativo em Nuques, até 1 trilhão.');
    if (!Array.isArray(data.effects) || data.effects.length > 12)
        fail(400, 'Use até 12 efeitos por item.');
    const seen = new Set<string>(), effects = data.effects.map(value => {
        const e = record(value);
        fields(e, ['id', 'name', 'description', 'magicDegree', 'activation', 'uses', 'frequency', 'requirements']);
        const id = e.id === null ? randomUUID() : text(e.id, 100);
        if (e.id !== null && !previous.some(p => p.id === id))
            fail(400, 'Efeito indisponível neste item.');
        if (seen.has(id))
            fail(400, 'Um efeito não pode ser repetido.');
        seen.add(id);
        return { id, name: text(e.name, 120), description: text(e.description, 600, false), magicDegree: text(e.magicDegree, 80, false), activation: text(e.activation, 200, false),
            uses: text(e.uses, 120, false), frequency: text(e.frequency, 120, false), requirements: text(e.requirements, 240, false) };
    });
    return { ...Object.fromEntries(short.map(key => [key, text(data[key], 200, false)])) as Pick<ItemPrivate, typeof short[number]>,
        materials: text(data.materials, 1000, false), properties: text(data.properties, 1500, false), secretText: text(data.secretText, 4000, false), notes: text(data.notes, 2000, false),
        referenceValueNuques: money(data.referenceValueNuques), chosenPriceNuques: money(data.chosenPriceNuques), effects };
}
function ready(p: ItemPayload) {
    if (p.fileId && !p.alt)
        fail(422, 'Preencha o texto alternativo antes de preparar ou publicar.');
}
function pending(row: Row) { return !!row.published_json && (row.draft_json !== row.published_json || row.draft_policy_json !== row.published_policy_json); }
async function administrative(db: DB, row: Row) {
    const payload = payloadOf(row), file = payload.fileId ? await one(db, 'SELECT id,origin_asset FROM workshop_files WHERE id=?', payload.fileId) : null;
    return { id: row.id, status: row.status, version: row.version, payload, policy: policyOf(row), private: privateOf(row), hasUnpublishedChanges: pending(row), publishedRevision: row.published_revision,
        sourceImage: file ? { image: `/api/master/workshop/files/${file.id}`, originalAlreadyPublic: !!file.origin_asset } : null };
}
function snapshot(row: Row) {
    return { status: row.status, version: row.version, payload: payloadOf(row), policy: policyOf(row), private: privateOf(row),
        published: row.published_json ? payloadOf(row, true) : null, publishedPolicy: row.published_policy_json ? policyOf(row, true) : null, publishedRevision: row.published_revision };
}
async function revision(db: DB, row: Row, actor: Session, action: string) {
    await db.prepare('INSERT INTO item_revisions(item_id,version,actor_id,action,snapshot_json) VALUES(?,?,?,?,?)').run(String(row.id), Number(row.version), actor.userId, action, JSON.stringify(snapshot(row)));
    await audit(db, actor.userId, `ITEM_${action}`, 'ITEM', String(row.id), { version: row.version });
}
async function canRead(db: DB, viewer: Viewer, row: Row) { return row.status === 'PUBLISHED' && !!row.published_json && (viewer.role === 'MASTER' || await policyAllows(db, viewer, policyOf(row, true))); }
function project(row: Row, draft = false, image?: string) {
    const p = payloadOf(row, !draft);
    return { id: row.id, name: p.name, description: p.description, alt: p.fileId ? p.alt : '', image: p.fileId ? (image ?? `/api/workshop/items/${row.id}/image?stamp=${imageStamp(row)}`) : null };
}
function copyText(row: Row) { const p = payloadOf(row, true); return { text: [p.name, p.description].filter(Boolean).join('\n\n') }; }
async function createItem(db: DB, actor: Session, data: Record<string, unknown>) {
    fields(data, ['payload', 'policy', 'private']);
    const payload = await validatePayload(db, data.payload), policy = await validatePolicy(db, data.policy), internal = validatePrivate(data.private), id = randomUUID();
    return await transaction(db, async () => {
        await db.prepare('INSERT INTO catalog_items(id,owner_user_id,draft_json,draft_policy_json,private_json) VALUES(?,?,?,?,?)').run(id, actor.userId, JSON.stringify(payload), JSON.stringify(policy), JSON.stringify(internal));
        const row = await getItem(db, id);
        await revision(db, row, actor, 'CREATED');
        return await administrative(db, row);
    });
}
async function saveItem(db: DB, actor: Session, id: string, data: Record<string, unknown>) {
    fields(data, ['version', 'payload', 'policy', 'private']);
    return await transaction(db, async () => {
        const before = await getItem(db, id);
        expected(before, data.version);
        if (before.status === 'ARCHIVED')
            fail(409, 'Restaure o item antes de editar.');
        const payload = await validatePayload(db, data.payload), policy = await validatePolicy(db, data.policy), internal = validatePrivate(data.private, privateOf(before).effects);
        await db.prepare("UPDATE catalog_items SET draft_json=?,draft_policy_json=?,private_json=?,version=version+1,status=CASE WHEN status='PREPARED' THEN 'DRAFT' ELSE status END,updated_at=? WHERE id=?")
            .run(JSON.stringify(payload), JSON.stringify(policy), JSON.stringify(internal), now(), id);
        const row = await getItem(db, id);
        await revision(db, row, actor, 'SAVED');
        return await administrative(db, row);
    });
}
async function command(db: DB, actor: Session, id: string, action: string, data: Record<string, unknown>) {
    fields(data, ['version']);
    return await transaction(db, async () => {
        const before = await getItem(db, id);
        expected(before, data.version);
        const payload = payloadOf(before);
        if (action === 'duplicate') {
            const copyId = randomUUID(), internal = privateOf(before);
            payload.name = `${payload.name.slice(0, 110)} — cópia`;
            internal.effects = internal.effects.map(e => ({ ...e, id: randomUUID() }));
            await db.prepare('INSERT INTO catalog_items(id,owner_user_id,draft_json,draft_policy_json,private_json) VALUES(?,?,?,?,?)').run(copyId, actor.userId, JSON.stringify(payload), String(before.draft_policy_json), JSON.stringify(internal));
            const row = await getItem(db, copyId);
            await revision(db, row, actor, 'DUPLICATED');
            return await administrative(db, row);
        }
        if (action === 'archive') {
            if (before.status === 'ARCHIVED')
                fail(409, 'O item já está arquivado.');
            await db.prepare("UPDATE catalog_items SET status='ARCHIVED',version=version+1,updated_at=? WHERE id=?").run(now(), id);
        }
        else if (action === 'restore') {
            if (before.status !== 'ARCHIVED')
                fail(409, 'Somente um item arquivado pode ser restaurado.');
            await db.prepare("UPDATE catalog_items SET status='DRAFT',version=version+1,updated_at=? WHERE id=?").run(now(), id);
        }
        else if (action === 'prepare' || action === 'publish') {
            if (before.status === 'ARCHIVED')
                fail(409, 'Restaure o item antes de preparar ou publicar.');
            ready(payload);
            if (action === 'prepare') {
                if (before.status === 'PUBLISHED')
                    fail(409, 'O item já possui uma revisão publicada.');
                await db.prepare("UPDATE catalog_items SET status='PREPARED',version=version+1,updated_at=? WHERE id=?").run(now(), id);
            }
            else
                await db.prepare("UPDATE catalog_items SET status='PUBLISHED',version=version+1,published_json=draft_json,published_policy_json=draft_policy_json,published_revision=version+1,published_at=?,updated_at=? WHERE id=?").run(now(), now(), id);
        }
        else
            fail(404, 'Ação não encontrada.');
        const row = await getItem(db, id);
        await revision(db, row, actor, action.toUpperCase());
        return await administrative(db, row);
    });
}
async function listItems(db: DB, url: URL, viewer?: Viewer) {
    const q = (url.searchParams.get('q') ?? '').trim().toLocaleLowerCase('pt-BR').slice(0, 120), status = url.searchParams.get('status'), category = url.searchParams.get('category');
    const rows = await filterAsync((await all(db, 'SELECT * FROM catalog_items ORDER BY updated_at DESC,id')), async (row) => {
        if (viewer && !await canRead(db, viewer, row))
            return false;
        const p = payloadOf(row, !!viewer);
        return (!q || `${p.name} ${p.description}`.toLocaleLowerCase('pt-BR').includes(q)) && (!!viewer || !status || row.status === status) && (!!viewer || !category || privateOf(row).category === category);
    });
    const requested = Number(url.searchParams.get('page') ?? 1), page = Number.isInteger(requested) && requested >= 1 && requested <= 1000000 ? requested : 1;
    return { total: rows.length, page, pageSize: 12, items: await mapAsync(rows.slice((page - 1) * 12, page * 12), async (row) => viewer ? project(row) : await administrative(db, row)) };
}
async function image(db: DB, config: Config, res: ServerResponse, row: Row, draft = false) {
    const payload = payloadOf(row, !draft);
    if (!payload.fileId)
        fail(404, 'Imagem indisponível.');
    await renderImage(db, config, res, { fileId: payload.fileId, crop: payload.crop }, false);
}
const readBody = async (req: IncomingMessage) => await jsonBody(req, 262144);
export async function handleItems(req: IncomingMessage, res: ServerResponse, url: URL, db: DB, config: Config, session?: Session): Promise<boolean> {
    const path = url.pathname, method = req.method ?? 'GET', admin = path.startsWith('/api/master/workshop/items');
    if (!admin && !path.startsWith('/api/workshop/items'))
        return false;
    if (admin) {
        const actor = requireMaster(session);
        if (url.searchParams.has('view_as'))
            fail(403, 'Saia da visualização para administrar.');
        if (path === '/api/master/workshop/items/references' && method === 'GET') {
            const list = await listItems(db, url);
            send(res, 200, { ...list, items: list.items.map(i => ({ id: i.id, name: 'payload' in i ? i.payload.name : i.name, status: 'status' in i ? i.status : null })) });
            return true;
        }
        if (path === '/api/master/workshop/items') {
            if (method === 'GET') {
                send(res, 200, await listItems(db, url));
                return true;
            }
            if (method === 'POST') {
                send(res, 201, await createItem(db, actor, await readBody(req)));
                return true;
            }
        }
        const match = path.match(/^\/api\/master\/workshop\/items\/([\w-]+)(?:\/(history|preview|preview-image|image|prepare|publish|archive|restore|duplicate))?$/);
        if (match) {
            const id = match[1]!, action = match[2], row = await getItem(db, id);
            if (!action && method === 'GET') {
                send(res, 200, await administrative(db, row));
                return true;
            }
            if (!action && method === 'PATCH') {
                send(res, 200, await saveItem(db, actor, id, await readBody(req)));
                return true;
            }
            if (action === 'history' && method === 'GET') {
                const requested = Number(url.searchParams.get('page') ?? 1), page = Number.isSafeInteger(requested) && requested > 0 && requested <= 100000 ? requested : 1;
                send(res, 200, { items: (await all(db, 'SELECT version,actor_id,action,snapshot_json,created_at FROM item_revisions WHERE item_id=? ORDER BY version DESC LIMIT 20 OFFSET ?', id, (page - 1) * 20)).map(r => ({ version: r.version, actorId: r.actor_id, action: r.action, createdAt: r.created_at, snapshot: JSON.parse(String(r.snapshot_json)) })) });
                return true;
            }
            if (action === 'image' && method === 'GET') {
                if (String(row.version) !== url.searchParams.get('version'))
                    fail(404, 'Prévia desatualizada.');
                await image(db, config, res, row, true);
                return true;
            }
            if ((action === 'preview' || action === 'preview-image') && method === 'GET') {
                const characterId = text(url.searchParams.get('character'), 100);
                await exists(db, 'characters', characterId);
                const source = url.searchParams.get('source') ?? 'draft';
                if (!['draft', 'published'].includes(source))
                    fail(400, 'Prévia inválida.');
                const viewer: Viewer = { userId: actor.userId, role: 'PLAYER', characterId, preview: true }, draft = source === 'draft';
                const allowed = draft ? row.status !== 'ARCHIVED' && await policyAllows(db, viewer, policyOf(row)) : await canRead(db, viewer, row);
                if (action === 'preview') {
                    const imageURL = `/api/master/workshop/items/${id}/preview-image?character=${encodeURIComponent(characterId)}&source=${source}&version=${row.version}`;
                    send(res, 200, { accessible: allowed, preview: true, item: allowed ? project(row, draft, imageURL) : null });
                    return true;
                }
                if (!allowed || String(row.version) !== url.searchParams.get('version'))
                    fail(404, 'Imagem indisponível.');
                await image(db, config, res, row, draft);
                return true;
            }
            if (action && ['prepare', 'publish', 'duplicate', 'archive', 'restore'].includes(action) && method === 'POST') {
                send(res, 200, await command(db, actor, id, action, await readBody(req)));
                return true;
            }
        }
        fail(404, 'Recurso não encontrado.');
    }
    const viewer = await viewerFor(db, requireSession(session), url);
    if (path === '/api/workshop/items' && method === 'GET') {
        send(res, 200, await listItems(db, url, viewer));
        return true;
    }
    if (path === '/api/workshop/items/references' && method === 'GET') {
        const list = await listItems(db, url, viewer);
        send(res, 200, { ...list, items: list.items.map(i => ({ id: i.id, name: 'name' in i ? i.name : i.payload.name })) });
        return true;
    }
    const match = path.match(/^\/api\/workshop\/items\/([\w-]+)(?:\/(image|copy))?$/);
    if (match && method === 'GET') {
        const row = await getItem(db, match[1]!);
        if (!await canRead(db, viewer, row))
            fail(404, 'Artigo não encontrado.');
        if (match[2] === 'copy') {
            send(res, 200, copyText(row));
            return true;
        }
        if (match[2] === 'image') {
            if (url.searchParams.get('stamp') !== imageStamp(row))
                fail(404, 'Imagem indisponível.');
            await image(db, config, res, row);
            return true;
        }
        send(res, 200, project(row));
        return true;
    }
    fail(404, 'Recurso não encontrado.');
}
