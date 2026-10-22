import { randomUUID, randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { all, one, transaction, audit, type DB, type Row } from './db.ts';
import { fail, requireMaster, type Session } from './auth.ts';
import { fields, jsonBody, record, text, send } from './http.ts';
import { contentSchema, contentRevision, validateContent, type Field, type ContentPayload } from './content.ts';
import { kindFamilies, templateSnapshot } from './templates-model.ts';
import type { Config } from './config.ts';
const hash = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const fileName = /^[0-9a-f-]{36}\.webp$/;
// Keep current identities, sessions and audit while restoring campaign state.
const protectedTables = new Set(['users', 'sessions', 'invites', 'auth_limits', 'schema_migrations', 'audit_log']);
function tables(db: DB) { return all(db, "SELECT name,sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"); }
function schemaHash(db: DB) { return hash(JSON.stringify(tables(db))); }
function rows(db: DB) { return Object.fromEntries(tables(db).map(t => [String(t.name), all(db, `SELECT * FROM "${t.name}" ORDER BY rowid`)])); }
function fingerprint(db: DB) { const state = rows(db); for (const name of ['sessions', 'auth_limits', 'audit_log'])
    delete state[name]; return hash(JSON.stringify(state)); }
function key(config: Config) { const path = join(config.dataDir, 'backup.key'); if (!existsSync(path))
    writeFileSync(path, randomBytes(32), { mode: 0o600, flag: 'wx' }); const k = readFileSync(path); if (k.length !== 32)
    throw new Error('Chave de recuperação inválida.'); return k; }
type Snapshot = {
    schema: string;
    tables: Record<string, Row[]>;
    media: {
        key: string;
        bytes: string;
        sha256: string;
    }[];
};
function snapshot(db: DB, config: Config): Snapshot { const keys = new Set([...all(db, 'SELECT storage_key FROM media'), ...all(db, 'SELECT storage_key FROM workshop_files')].map(r => String(r.storage_key))); return { schema: schemaHash(db), tables: rows(db), media: [...keys].map(name => { if (!fileName.test(name))
        fail(422, 'Chave de mídia inválida no arquivo local.'); const bytes = readFileSync(join(config.dataDir, 'media', name)); return { key: name, bytes: bytes.toString('base64'), sha256: hash(bytes) }; }) }; }
function seal(db: DB, config: Config) { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(config), iv); cipher.setAAD(Buffer.from('HOGWARTS_BACKUP_V1')); const encrypted = Buffer.concat([cipher.update(JSON.stringify(snapshot(db, config)), 'utf8'), cipher.final()]); return { format: 'HOGWARTS_PRIVATE_BACKUP', version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: encrypted.toString('base64') }; }
function unseal(db: DB, config: Config, value: Record<string, unknown>): Snapshot { fields(value, ['format', 'version', 'iv', 'tag', 'ciphertext']); if (value.format !== 'HOGWARTS_PRIVATE_BACKUP' || value.version !== 1)
    fail(422, 'Formato de backup incompatível.'); let result: Snapshot; try {
    const iv = Buffer.from(text(value.iv, 24), 'base64'), tag = Buffer.from(text(value.tag, 32), 'base64');
    if (iv.length !== 12 || tag.length !== 16)
        throw new Error();
    const decipher = createDecipheriv('aes-256-gcm', key(config), iv);
    decipher.setAAD(Buffer.from('HOGWARTS_BACKUP_V1'));
    decipher.setAuthTag(tag);
    const bytes = Buffer.concat([decipher.update(Buffer.from(text(value.ciphertext, 128 * 1024 * 1024), 'base64')), decipher.final()]);
    result = JSON.parse(bytes.toString('utf8'));
}
catch {
    fail(422, 'Backup inválido ou de outra instalação.');
} if (result.schema !== schemaHash(db))
    fail(422, 'A versão das migrations difere. Use a recuperação operacional documentada.'); const live = tables(db).map(t => String(t.name)); if (!result.tables || Object.keys(result.tables).sort().join() !== live.sort().join() || !Array.isArray(result.media))
    fail(422, 'Estrutura de backup incompleta.'); for (const t of live) {
    const columns = all(db, `PRAGMA table_info("${t}")`).map(c => String(c.name)).sort().join();
    if (!Array.isArray(result.tables[t]) || result.tables[t]!.some(r => Object.keys(r).sort().join() !== columns || Object.values(r).some(v => v !== null && typeof v !== 'string' && typeof v !== 'number')))
        fail(422, 'Tabela de backup incompatível.');
} if (result.tables.schema_migrations!.map(r => String(r.name)).sort().join() !== all(db, 'SELECT name FROM schema_migrations').map(r => String(r.name)).sort().join())
    fail(422, 'A versão das migrations difere. Use a recuperação operacional documentada.'); for (const f of result.media)
    if (!fileName.test(f.key) || hash(Buffer.from(f.bytes, 'base64')) !== f.sha256)
        fail(422, 'Mídia de backup inválida.'); return result; }
function recovery(db: DB, config: Config) { const directory = join(config.dataDir, 'recoveries'); mkdirSync(directory, { recursive: true, mode: 0o700 }); const name = randomUUID() + '.hogwarts'; writeFileSync(join(directory, name), JSON.stringify(seal(db, config)), { mode: 0o600, flag: 'wx' }); return name; }
type Image = {
    id: string;
    key: string;
    bytes: Buffer;
    width: number;
    height: number;
};
type ImportRow = {
    id: string;
    sourceId: string;
    kind: string;
    payload: ContentPayload;
    policy: unknown;
    privateNotes: string;
};
type Plan = {
    actor: string;
    expires: number;
    fingerprint: string;
    mode: 'IMPORT' | 'RESTORE';
    images: Image[];
    records: ImportRow[];
    snapshot?: Snapshot;
    summary: unknown;
};
const plans = new Map<string, Plan>();
function remember(actor: Session, plan: Omit<Plan, 'actor' | 'expires'>) { for (const [id, p] of plans)
    if (p.actor === actor.userId || p.expires < Date.now())
        plans.delete(id); const id = randomUUID(); plans.set(id, { ...plan, actor: actor.userId, expires: Date.now() + 10 * 60 * 1000 }); return { planId: id, summary: plan.summary }; }
function imageIDs(p: ContentPayload, fields: Field[]): string[] { return fields.flatMap(f => f.type === 'image' && p[f.name] ? [String(p[f.name])] : f.type === 'blocks' ? (Array.isArray(p[f.name]) ? p[f.name] as ContentPayload[] : []).flatMap(b => imageIDs(record(b), f.fields ?? [])) : []); }
function rewrite(p: ContentPayload, definitions: Field[], ids: Map<string, string>, files: Map<string, string>): ContentPayload { return Object.fromEntries(Object.entries(p).map(([k, v]) => { const f = definitions.find(f => f.name === k); return [k, f?.type === 'blocks' && Array.isArray(v) ? v.map(b => rewrite(record(b), f.fields ?? [], ids, files)) : f?.type === 'image' && typeof v === 'string' ? files.get(v) ?? v : f?.type === 'reference' && typeof v === 'string' && !['regions', 'places', 'years'].includes(f.source ?? '') ? ids.get(v) ?? v : v]; })); }
function insertImport(db: DB, actor: Session, records: ImportRow[], images: Image[], validated = false) { for (const f of images)
    db.prepare('INSERT INTO workshop_files(id,owner_user_id,storage_key,mime,bytes,width,height) VALUES(?,?,?,?,?,?,?)').run(f.id, actor.userId, f.key, 'image/webp', f.bytes.length, f.width, f.height); for (const r of records)
    db.prepare('INSERT INTO content_records(id,kind,owner_user_id,draft_json,draft_policy_json,private_notes) VALUES(?,?,?,?,?,?)').run(r.id, r.kind, actor.userId, JSON.stringify(r.payload), JSON.stringify(r.policy), r.privateNotes); for (const r of records) {
    const v = validateContent(db, r.kind, { payload: r.payload, policy: r.policy, privateNotes: r.privateNotes }), template = kindFamilies[r.kind] && r.payload.templateId ? templateSnapshot(db, r.payload.templateId, kindFamilies[r.kind]!) : null;
    db.prepare('UPDATE content_records SET draft_json=?,draft_policy_json=?,private_notes=?,draft_template_json=? WHERE id=?').run(JSON.stringify(v.p), JSON.stringify(v.policy), v.notes, template ? JSON.stringify(template) : null, r.id);
    if (validated)
        contentRevision(db, one(db, 'SELECT * FROM content_records WHERE id=?', r.id)!, actor, 'IMPORTED_DRAFT');
} }
async function prepareImport(db: DB, actor: Session, value: Record<string, unknown>) {
    fields(value, ['package', 'strategy']);
    const p = record(value.package);
    fields(p, ['format', 'version', 'records', 'images']);
    if (p.format !== 'HOGWARTS_CONTENT' || p.version !== 1 || !Array.isArray(p.records) || p.records.length > 1000 || !Array.isArray(p.images) || p.images.length > 500)
        fail(422, 'Pacote de conteúdo incompatível.');
    if (!['SKIP', 'COPY'].includes(String(value.strategy)))
        fail(422, 'Escolha como tratar IDs existentes.');
    const ids = new Map<string, string>(), source = new Set<string>(), records: ImportRow[] = [];
    for (const valueRow of p.records) {
        const r = record(valueRow);
        fields(r, ['id', 'kind', 'payload', 'policy', 'privateNotes']);
        const id = text(r.id, 100), kind = text(r.kind, 100);
        if (!/^[\w-]{1,100}$/.test(id) || source.has(id))
            fail(422, 'IDs de conteúdo inválidos ou repetidos.');
        source.add(id);
        contentSchema(kind);
        const exists = one(db, 'SELECT id FROM content_records WHERE id=?', id);
        if (exists && value.strategy === 'SKIP')
            continue;
        const newId = exists ? randomUUID() : id;
        ids.set(id, newId);
        records.push({ id: newId, sourceId: id, kind, payload: record(r.payload), policy: r.policy, privateNotes: text(r.privateNotes, 8000, false) });
    }
    const imported = new Map<string, Record<string, unknown>>();
    for (const v of p.images) {
        const f = record(v);
        fields(f, ['id', 'bytes']);
        const id = text(f.id, 100);
        if (!uuid.test(id) || imported.has(id))
            fail(422, 'IDs de imagens inválidos ou repetidos.');
        imported.set(id, f);
    }
    const files = new Map<string, string>(), images: Image[] = [];
    for (const id of new Set(records.flatMap(r => imageIDs(r.payload, contentSchema(r.kind).fields)))) {
        const f = imported.get(id);
        if (!f) {
            if (!one(db, 'SELECT id FROM workshop_files WHERE id=?', id))
                fail(422, 'Falta uma imagem referenciada.');
            continue;
        }
        const bytes = Buffer.from(text(f.bytes, 3 * 1024 * 1024), 'base64');
        if (bytes.length > 2 * 1024 * 1024)
            fail(413, 'Imagem excede 2 MB.');
        try {
            const image = sharp(bytes, { limitInputPixels: 16000000, animated: false, failOn: 'warning' }), meta = await image.metadata();
            if (!['png', 'jpeg', 'webp'].includes(meta.format ?? '') || (meta.pages ?? 1) > 1)
                throw new Error();
            const clean = await image.autoOrient().resize(2048, 2048, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 88 }).toBuffer(), size = await sharp(clean).metadata(), newId = randomUUID();
            files.set(id, newId);
            images.push({ id: newId, key: newId + '.webp', bytes: clean, width: size.width!, height: size.height! });
        }
        catch {
            fail(422, 'Imagem importada inválida.');
        }
    }
    const pendingTemplates: string[] = [];
    for (const r of records) {
        r.payload = rewrite(r.payload, contentSchema(r.kind).fields, ids, files);
        if (r.payload.templateId && !one(db, "SELECT id FROM content_records WHERE id=? AND kind='templates' AND status='PUBLISHED'", String(r.payload.templateId))) {
            r.payload.templateId = null;
            pendingTemplates.push(String(r.payload.title));
        }
    }
    // Validate in a rollback-only transaction: no draft or media metadata survives preview.
    db.exec('BEGIN IMMEDIATE');
    try {
        insertImport(db, actor, records, images);
        db.exec('ROLLBACK');
    }
    catch (e) {
        db.exec('ROLLBACK');
        throw e;
    }
    return { records, images, summary: { pendingTemplates, records: records.map(r => ({ sourceId: r.sourceId, id: r.id, title: r.payload.title, kind: r.kind, state: 'DRAFT' })), skipped: source.size - records.length, images: images.length, warning: 'Apenas rascunhos novos. Nenhuma publicação, revelação ou concessão.' } };
}
// Names and columns are checked against the live schema by unseal; no uploaded SQL is executed.
function restore(db: DB, s: Snapshot, after: () => void) { db.exec('PRAGMA foreign_keys=OFF'); try {
    transaction(db, () => { for (const t of Object.keys(s.tables))
        if (!protectedTables.has(t))
            db.exec(`DELETE FROM "${t}"`); for (const [t, rows] of Object.entries(s.tables)) {
        if (protectedTables.has(t))
            continue;
        for (const r of rows) {
            const columns = Object.keys(r);
            db.prepare(`INSERT INTO "${t}"(${columns.map(c => '"' + c + '"').join(',')}) VALUES(${columns.map(() => '?').join(',')})`).run(...columns.map(k => r[k] ?? null));
        }
    } if (all(db, 'PRAGMA foreign_key_check').length)
        fail(422, 'O backup não é compatível com os vínculos atuais das contas.'); after(); });
}
finally {
    db.exec('PRAGMA foreign_keys=ON');
} }
export async function handleArchives(req: IncomingMessage, res: ServerResponse, url: URL, db: DB, config: Config, session?: Session): Promise<boolean> {
    const path = url.pathname;
    if (!path.startsWith('/api/master/archives'))
        return false;
    const actor = requireMaster(session);
    if (url.searchParams.has('view_as'))
        fail(403, 'Saia da prévia para administrar arquivos.');
    const method = req.method ?? 'GET';
    if (path === '/api/master/archives' && method === 'GET') {
        send(res, 200, { contentRecords: one(db, 'SELECT count(*) n FROM content_records')!.n, formatVersion: 1, migrations: all(db, 'SELECT name FROM schema_migrations ORDER BY name').map(r => r.name) });
        return true;
    }
    if (path === '/api/master/archives/export' && method === 'GET') {
        const records = all(db, 'SELECT * FROM content_records').map(r => ({ id: r.id, kind: r.kind, payload: JSON.parse(String(r.draft_json)), policy: JSON.parse(String(r.draft_policy_json)), privateNotes: r.private_notes })), used = new Set(records.flatMap(r => imageIDs(r.payload, contentSchema(String(r.kind)).fields))), images = all(db, 'SELECT * FROM workshop_files').filter(f => used.has(String(f.id))).map(f => ({ id: f.id, bytes: readFileSync(join(config.dataDir, 'media', String(f.storage_key))).toString('base64') }));
        res.setHeader('Content-Disposition', 'attachment; filename="hogwarts-conteudos.json"');
        send(res, 200, { format: 'HOGWARTS_CONTENT', version: 1, records, images });
        return true;
    }
    if (path === '/api/master/archives/backup' && method === 'GET') {
        res.setHeader('Content-Disposition', 'attachment; filename="hogwarts-backup.hogwarts"');
        send(res, 200, seal(db, config));
        return true;
    }
    if (path === '/api/master/archives/prepare-import' && method === 'POST') {
        const data = await jsonBody(req, 64 * 1024 * 1024), prepared = await prepareImport(db, actor, data);
        send(res, 200, remember(actor, { ...prepared, fingerprint: fingerprint(db), mode: 'IMPORT' }));
        return true;
    }
    if (path === '/api/master/archives/prepare-restore' && method === 'POST') {
        const s = unseal(db, config, await jsonBody(req, 128 * 1024 * 1024));
        send(res, 200, remember(actor, { fingerprint: fingerprint(db), mode: 'RESTORE', images: [], records: [], snapshot: s, summary: { warning: 'Restaura o conteúdo, as jornadas e as mídias desta instalação. Contas, convites, sessões e auditoria atuais serão preservados.', media: s.media.length, contentRecords: s.tables.content_records?.length ?? 0 } }));
        return true;
    }
    if (path === '/api/master/archives/apply' && method === 'POST') {
        const d = await jsonBody(req);
        fields(d, ['planId', 'confirmation']);
        const id = text(d.planId, 100), plan = plans.get(id);
        if (!plan || plan.actor !== actor.userId || plan.expires < Date.now())
            fail(409, 'Revise o arquivo novamente.');
        if (d.confirmation !== (plan.mode === 'RESTORE' ? 'RESTAURAR' : 'IMPORTAR'))
            fail(422, 'Digite a confirmação indicada.');
        if (plan.fingerprint !== fingerprint(db))
            fail(409, 'A campanha mudou desde a revisão. Revise novamente antes de aplicar.');
        const safetyBackup = recovery(db, config), written: string[] = [];
        try {
            if (plan.mode === 'IMPORT') {
                for (const f of plan.images) {
                    const file = join(config.dataDir, 'media', f.key);
                    writeFileSync(file, f.bytes, { mode: 0o600, flag: 'wx' });
                    written.push(file);
                }
                transaction(db, () => { insertImport(db, actor, plan.records, plan.images, true); audit(db, actor.userId, 'ARCHIVE_IMPORT', 'ARCHIVE', id, { safetyBackup }); });
            }
            else {
                const s = plan.snapshot!;
                for (const f of s.media) {
                    const file = join(config.dataDir, 'media', f.key);
                    if (existsSync(file)) {
                        if (hash(readFileSync(file)) !== f.sha256)
                            fail(422, 'Há conflito entre imagens de mesmo identificador.');
                    }
                    else {
                        writeFileSync(file, Buffer.from(f.bytes, 'base64'), { mode: 0o600, flag: 'wx' });
                        written.push(file);
                    }
                }
                restore(db, s, () => audit(db, actor.userId, 'ARCHIVE_RESTORE', 'ARCHIVE', id, { safetyBackup }));
            }
            plans.delete(id);
            send(res, 200, { ok: true, safetyBackup });
            return true;
        }
        catch (e) {
            for (const f of written)
                unlinkSync(f);
            throw e;
        }
    }
    fail(404, 'Operação de arquivo não encontrada.');
}
