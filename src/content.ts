import { filterAsync, mapAsync } from './async-array.ts';
import { kindFamilies, templateFamilies, templateChoices, templateSnapshot } from './templates-model.ts';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Config } from './config.ts';
import { all, one, transaction, audit, type DB, type Row } from './db.ts';
import { fail, now, requireMaster, requireSession, viewerFor, type Session, type Viewer } from './auth.ts';
import { jsonBody, fields, record, text, send } from './http.ts';
import { validatePolicy, policyAllows, expected, imageStamp, type Policy } from './editorial.ts';
import { renderImage } from './workshop.ts';
type MaybePromise<T> = T | Promise<T>;
export type ContentPayload = Record<string, unknown>;
export type Field = {
    name: string;
    label: string;
    type?: 'text' | 'textarea' | 'richtext' | 'id' | 'policy' | 'select' | 'reference' | 'number' | 'checkbox' | 'image' | 'blocks';
    required?: boolean;
    // Empty drafts may defer these fields. Preparing/publishing revalidates
    // them in full before any published snapshot or native mirror changes.
    draftOptional?: boolean;
    max?: number;
    min?: number;
    options?: string[];
    source?: string;
    advanced?: boolean;
    fields?: Field[];
};
export type ContentSchema = {
    label: string;
    singular: string;
    fields: Field[];
    global?: boolean;
    imageField?: string;
    retainArchive?: boolean;
    admin?: (db: DB, row: Row) => MaybePromise<ContentPayload>;
    listed?: (row: Row) => MaybePromise<boolean>;
    duplicate?: (p: ContentPayload) => MaybePromise<ContentPayload>;
    validate?: (db: DB, p: ContentPayload, policy: Policy) => MaybePromise<void>;
    allowed?: (db: DB, v: Viewer, row: Row, p: ContentPayload) => MaybePromise<boolean>;
    project: (db: DB, v: Viewer, row: Row, p: ContentPayload) => MaybePromise<ContentPayload>;
    published?: (db: DB, row: Row, before: Row) => MaybePromise<void>;
    archived?: (db: DB, row: Row) => MaybePromise<void>;
    action?: (db: DB, actor: Session, row: Row, action: string, data: Record<string, unknown>) => unknown;
};
const schemas = new Map<string, ContentSchema>();
type ReferenceProvider = (db: DB) => MaybePromise<{
    id: string;
    name: string;
}[]>;
const references = new Map<string, ReferenceProvider>();
export function registerContent(kind: string, schema: ContentSchema) {
    if (kindFamilies[kind])
        schema.fields = [...schema.fields, { name: 'templateId', label: 'Modelo reutilizável', type: 'reference', source: 'template_' + kindFamilies[kind], advanced: true }];
    schemas.set(kind, schema);
}
export function registerReference(name: string, provider: ReferenceProvider) { references.set(name, provider); }
for (const family of templateFamilies)
    registerReference('template_' + family, async (db) => await templateChoices(db, family));
export const contentSchema = (kind: string) => schemas.get(kind) ?? fail(404, 'Oficina não encontrada.');
export const contentRecord = async (db: DB, kind: string, id: string) => await one(db, 'SELECT * FROM content_records WHERE id=? AND kind=?', id, kind) ?? fail(404, 'Registro não encontrado.');
export const contentPayload = (row: Row, published = true): ContentPayload => JSON.parse(String(published ? row.published_json : row.draft_json));
export const contentPolicy = (row: Row, published = true): Policy => JSON.parse(String(published ? row.published_policy_json : row.draft_policy_json));
export async function contentAllowed(db: DB, v: Viewer, row: Row, draft = false) { const schema = contentSchema(String(row.kind)), p = contentPayload(row, !draft); return (draft || !!row.published_json && (row.status === 'PUBLISHED' || !!schema.retainArchive)) && await policyAllows(db, v, contentPolicy(row, !draft)) && (await schema.allowed?.(db, v, row, p) ?? true); }
export async function contentProject(db: DB, v: Viewer, row: Row, draft = false): Promise<ContentPayload> {
    const schema = contentSchema(String(row.kind)), p = contentPayload(row, !draft), imageField = schema.imageField ?? 'fileId';
    const dto = await schema.project(db, v, row, p);
    if (draft && Array.isArray(dto.sections))
        dto.sections = dto.sections.map((section: ContentPayload) => ({ ...section, image: typeof section.image === 'string' && section.image.startsWith('/api/journals/') ? section.image.replace('/api/journals/', '/api/master/journals/') + '&version=' + row.version + '&character=' + v.characterId : section.image }));
    return { id: row.id, kind: row.kind, ...dto, template: 'template' in dto ? dto.template : JSON.parse(String((draft ? row.draft_template_json : row.published_template_json) ?? 'null')), image: p[imageField] ? `/api/content/${row.kind}/${row.id}/image?stamp=${imageStamp(row)}` : dto.image ?? null, alt: p.alt ?? dto.alt ?? '' };
}
export async function contentAdmin(db: DB, row: Row) { return { id: row.id, kind: row.kind, status: row.status, version: row.version, payload: contentPayload(row, false), policy: contentPolicy(row, false), privateNotes: row.private_notes, publishedRevision: row.published_revision, hasUnpublishedChanges: !!row.published_json && (row.draft_json !== row.published_json || row.draft_policy_json !== row.published_policy_json), extra: await contentSchema(String(row.kind)).admin?.(db, row) ?? {} }; }
async function validateFields(db: DB, value: unknown, definitions: Field[], depth = 0, publication = false): Promise<ContentPayload> {
    const p = record(value);
    fields(p, definitions.map(f => f.name));
    return Object.fromEntries(await mapAsync(definitions, async (f) => {
        const value = p[f.name], type = f.type ?? 'text', required = !!f.required && (!f.draftOptional || publication);
        if (publication && f.required && f.draftOptional && (value === null || value === undefined || value === ''))
            fail(422, `Complete ${f.label} antes de preparar ou publicar.`);
        let output: unknown;
        if (type === 'id') {
            output = value === null || value === '' ? randomUUID() : text(value, 100);
        }
        else if (type === 'policy') {
            output = await validatePolicy(db, value);
        }
        else if (type === 'checkbox') {
            if (typeof value !== 'boolean')
                fail(400, `Confira ${f.label}.`);
            output = value;
        }
        else if (type === 'number') {
            if (value === null && !required)
                output = null;
            else if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (f.min ?? 0) || value > (f.max ?? 1e12))
                fail(400, `Confira ${f.label}.`);
            else
                output = value;
        }
        else if (type === 'blocks') {
            if (depth > 2 || !Array.isArray(value) || value.length > (f.max ?? 50))
                fail(400, `Confira ${f.label}.`);
            output = await mapAsync(value, async (block) => await validateFields(db, block, f.fields ?? [], depth + 1, publication));
        }
        else if (type === 'image' || type === 'reference') {
            if ((value === null || value === undefined || value === '') && !required)
                output = null;
            else {
                const id = text(value, 100);
                if (type === 'image') {
                    if (!await one(db, 'SELECT id FROM workshop_files WHERE id=?', id))
                        fail(400, 'Imagem indisponível.');
                }
                else if (!(await references.get(f.source ?? '')?.(db))?.some(r => r.id === id))
                    fail(400, `Referência indisponível: ${f.label}.`);
                output = id;
            }
        }
        else if (type === 'select') {
            output = text(value, 200, required);
            if (!(f.options ?? []).includes(String(output)))
                fail(400, `Confira ${f.label}.`);
        }
        else
            output = text(value, f.max ?? (type === 'textarea' ? 8000 : 180), required);
        return [f.name, output];
    }));
}
async function validateDeferredFields(db: DB, payload: ContentPayload, definitions: Field[]): Promise<void> {
    const deferred = definitions.filter(f => f.draftOptional);
    if (deferred.length)
        await validateFields(db, Object.fromEntries(deferred.map(f => [f.name, payload[f.name]])), deferred, 0, true);
    for (const f of definitions)
        if (f.type === 'blocks' && Array.isArray(payload[f.name]))
            for (const block of payload[f.name] as ContentPayload[])
                await validateDeferredFields(db, block, f.fields ?? []);
}
export async function validateContent(db: DB, kind: string, data: Record<string, unknown>) {
    const schema = contentSchema(kind), p = await validateFields(db, data.payload, schema.fields), policy = await validatePolicy(db, data.policy);
    if (schema.global) {
        policy.audience = 'ALL';
        policy.characters = [];
        policy.groups = [];
        policy.houses = [];
        policy.schoolYears = [];
        policy.cohorts = [];
        policy.excludedCharacters = [];
        policy.regionId = null;
        policy.locationId = null;
    }
    await schema.validate?.(db, p, policy);
    return { p, policy, notes: text(data.privateNotes, 8000, false) };
}
export async function contentRevision(db: DB, row: Row, actor: Session, action: string) { await db.prepare('INSERT INTO content_revisions(record_id,version,actor_id,action,snapshot_json) VALUES(?,?,?,?,?)').run(String(row.id), Number(row.version), actor.userId, action, JSON.stringify(row)); await audit(db, actor.userId, 'CONTENT_' + action, String(row.kind), String(row.id), { version: row.version }); }
async function create(db: DB, actor: Session, kind: string, data: Record<string, unknown>) { fields(data, ['payload', 'policy', 'privateNotes']); const { p, policy, notes } = await validateContent(db, kind, data), template = kindFamilies[kind] ? await templateSnapshot(db, p.templateId, kindFamilies[kind]!) : null, id = randomUUID(); return await transaction(db, async () => { await db.prepare('INSERT INTO content_records(id,kind,owner_user_id,draft_json,draft_policy_json,private_notes,draft_template_json) VALUES(?,?,?,?,?,?,?)').run(id, kind, actor.userId, JSON.stringify(p), JSON.stringify(policy), notes, template ? JSON.stringify(template) : null); const row = await contentRecord(db, kind, id); await contentRevision(db, row, actor, 'CREATED'); return await contentAdmin(db, row); }); }
async function save(db: DB, actor: Session, kind: string, id: string, data: Record<string, unknown>) {
    fields(data, ['version', 'payload', 'policy', 'privateNotes']);
    return await transaction(db, async () => {
        const before = await contentRecord(db, kind, id);
        expected(before, data.version);
        if (before.status === 'ARCHIVED')
            fail(409, 'Restaure antes de editar.');
        const { p, policy, notes } = await validateContent(db, kind, data), template = kindFamilies[kind] ? await templateSnapshot(db, p.templateId, kindFamilies[kind]!) : null;
        await db.prepare("UPDATE content_records SET draft_json=?,draft_policy_json=?,private_notes=?,draft_template_json=?,version=version+1,updated_at=?,status=CASE WHEN status='PREPARED' THEN 'DRAFT' ELSE status END WHERE id=?").run(JSON.stringify(p), JSON.stringify(policy), notes, template ? JSON.stringify(template) : null, now(), id);
        const row = await contentRecord(db, kind, id);
        await contentRevision(db, row, actor, 'SAVED');
        return await contentAdmin(db, row);
    });
}
async function command(db: DB, actor: Session, kind: string, id: string, action: string, data: Record<string, unknown>) {
    return await transaction(db, async () => {
        const before = await contentRecord(db, kind, id), schema = contentSchema(kind);
        expected(before, data.version);
        if (!['publish', 'prepare', 'duplicate', 'archive', 'restore'].includes(action)) {
            if (!schema.action)
                fail(404, 'Ação não encontrada.');
            return schema.action(db, actor, before, action, data);
        }
        fields(data, ['version']);
        if (action === 'duplicate') {
            const source = contentPayload(before, false), p = await schema.duplicate?.(source) ?? source;
            p.title = String(p.title).slice(0, (schema.fields.find(f => f.name === 'title')?.max ?? 180) - 8) + ' — cópia';
            const copy = randomUUID();
            await db.prepare('INSERT INTO content_records(id,kind,owner_user_id,draft_json,draft_policy_json,private_notes,draft_template_json) VALUES(?,?,?,?,?,?,?)').run(copy, kind, actor.userId, JSON.stringify(p), String(before.draft_policy_json), String(before.private_notes), before.draft_template_json ?? null);
            const row = await contentRecord(db, kind, copy);
            await contentRevision(db, row, actor, 'DUPLICATED');
            return await contentAdmin(db, row);
        }
        if (action === 'restore' && before.status !== 'ARCHIVED')
            fail(409, 'Somente arquivados podem ser restaurados.');
        if (action !== 'restore' && before.status === 'ARCHIVED')
            fail(409, 'Restaure antes desta ação.');
        if (action === 'publish' || action === 'prepare') {
            const p = contentPayload(before, false);
            await validateDeferredFields(db, p, schema.fields);
            await schema.validate?.(db, p, contentPolicy(before, false));
            const image = p[schema.imageField ?? 'fileId'];
            if (image && !p.alt)
                fail(422, 'Preencha o texto alternativo da imagem.');
        }
        if (action === 'prepare' && before.status === 'PUBLISHED')
            fail(409, 'O registro já possui uma revisão publicada.');
        const status: Record<string, string> = { publish: 'PUBLISHED', prepare: 'PREPARED', archive: 'ARCHIVED', restore: 'DRAFT' };
        await db.prepare('UPDATE content_records SET status=?,version=version+1,updated_at=? WHERE id=?').run(status[action]!, now(), id);
        if (action === 'publish') {
            await db.prepare('UPDATE content_records SET published_json=draft_json,published_policy_json=draft_policy_json,published_template_json=draft_template_json,published_revision=version WHERE id=?').run(id);
            await schema.published?.(db, await contentRecord(db, kind, id), before);
        }
        if (action === 'archive')
            await schema.archived?.(db, await contentRecord(db, kind, id));
        const row = await contentRecord(db, kind, id);
        await contentRevision(db, row, actor, action.toUpperCase());
        return await contentAdmin(db, row);
    });
}
async function list(db: DB, kind: string, url: URL, viewer?: Viewer) { const q = (url.searchParams.get('q') ?? '').trim().toLocaleLowerCase('pt-BR').slice(0, 120), status = url.searchParams.get('status'); const items = (await mapAsync((await filterAsync((await all(db, 'SELECT * FROM content_records WHERE kind=? ORDER BY updated_at DESC,id', kind)), async (r) => (!viewer || await contentAllowed(db, viewer, r) && (await contentSchema(kind).listed?.(r) ?? true)) && (!status || !!viewer || r.status === status) && (!url.searchParams.get('year') || contentPayload(r, !viewer ? false : true).academicYear === url.searchParams.get('year')) && (!url.searchParams.get('category') || (contentPayload(r, !viewer ? false : true).category ?? contentPayload(r, !viewer ? false : true).rarity) === url.searchParams.get('category')))), async (r) => viewer ? await contentProject(db, viewer, r) : await contentAdmin(db, r))).filter(p => !q || JSON.stringify(viewer ? p : ('payload' in p ? p.payload : {})).toLocaleLowerCase('pt-BR').includes(q)); return { items, total: items.length }; }
export async function handleContent(req: IncomingMessage, res: ServerResponse, url: URL, db: DB, config: Config, session?: Session): Promise<boolean> {
    const path = url.pathname, method = req.method ?? 'GET', admin = path.startsWith('/api/master/content');
    if (!admin && !path.startsWith('/api/content'))
        return false;
    const actor = requireSession(session);
    if (admin) {
        requireMaster(actor);
        if (url.searchParams.has('view_as'))
            fail(403, 'Saia da prévia para administrar.');
        if (path === '/api/master/content/context' && method === 'GET') {
            send(res, 200, { schemas: Object.fromEntries([...schemas].map(([kind, s]) => [kind, { label: s.label, singular: s.singular, fields: s.fields, global: !!s.global }])), references: Object.fromEntries(await mapAsync([...references], async ([name, fn]) => [name, await fn(db)])) });
            return true;
        }
    }
    const match = path.match(/^\/api\/(?:master\/)?content\/([a-z-]+)(?:\/([\w-]+)(?:\/([a-z-]+))?)?$/);
    if (!match)
        fail(404, 'Recurso não encontrado.');
    const kind = match[1]!, id = match[2], action = match[3];
    contentSchema(kind);
    const viewer = await viewerFor(db, actor, url);
    if (!id) {
        if (method === 'GET') {
            send(res, 200, await list(db, kind, url, admin ? undefined : viewer));
            return true;
        }
        if (admin && method === 'POST') {
            send(res, 201, await create(db, actor, kind, await jsonBody(req, 1048576)));
            return true;
        }
    }
    if (id) {
        const row = await contentRecord(db, kind, id);
        if (admin) {
            if (!action && method === 'GET') {
                send(res, 200, await contentAdmin(db, row));
                return true;
            }
            if (!action && method === 'PATCH') {
                send(res, 200, await save(db, actor, kind, id, await jsonBody(req, 1048576)));
                return true;
            }
            if (action === 'history' && method === 'GET') {
                send(res, 200, { items: (await all(db, 'SELECT version,action,snapshot_json,created_at FROM content_revisions WHERE record_id=? ORDER BY version DESC LIMIT 30', id)).map(r => ({ version: r.version, action: r.action, snapshot: JSON.parse(String(r.snapshot_json)), createdAt: r.created_at })) });
                return true;
            }
            if ((action === 'preview' || action === 'preview-image') && method === 'GET') {
                const char = text(url.searchParams.get('character'), 100);
                if (!await one(db, 'SELECT id FROM characters WHERE id=?', char))
                    fail(400, 'Personagem indisponível.');
                const v: Viewer = { userId: actor.userId, role: 'PLAYER', characterId: char, preview: true }, draft = url.searchParams.get('source') !== 'published';
                if (!await contentAllowed(db, v, row, draft))
                    fail(404, 'Registro não disponível para este personagem.');
                if (action === 'preview') {
                    send(res, 200, { ...await contentProject(db, v, row, draft), image: contentPayload(row, !draft)[contentSchema(kind).imageField ?? 'fileId'] ? `/api/master/content/${kind}/${id}/preview-image?character=${char}&source=${draft ? 'draft' : 'published'}` : null });
                    return true;
                }
                const p = contentPayload(row, !draft);
                await renderImage(db, config, res, { fileId: String(p[contentSchema(kind).imageField ?? 'fileId']), crop: { x: 0, y: 0, width: 100, height: 100 } }, false);
                return true;
            }
            if (method === 'POST') {
                send(res, 200, await command(db, actor, kind, id, action ?? '', await jsonBody(req, 1048576)));
                return true;
            }
        }
        else if (method === 'GET') {
            if (!await contentAllowed(db, viewer, row))
                fail(404, 'Registro não encontrado.');
            if (action === 'image') {
                if (url.searchParams.get('stamp') && url.searchParams.get('stamp') !== imageStamp(row))
                    fail(404, 'Imagem indisponível.');
                const p = contentPayload(row), file = p[contentSchema(kind).imageField ?? 'fileId'];
                if (!file)
                    fail(404, 'Imagem indisponível.');
                await renderImage(db, config, res, { fileId: String(file), crop: { x: 0, y: 0, width: 100, height: 100 } }, false);
                return true;
            }
            if (!action) {
                send(res, 200, await contentProject(db, viewer, row));
                return true;
            }
        }
    }
    fail(404, 'Recurso não encontrado.');
}
