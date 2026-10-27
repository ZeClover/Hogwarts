import { upgradeBackupState, validationDatabase } from './import-validation.ts';
import type { Statement } from './async-db.ts';
import { handleArchiveUploads, archiveInput } from './archive-uploads.ts';
import { privateStorage } from './storage.ts';
import { mapAsync } from './async-array.ts';
import { randomUUID, randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { all, one, transaction, audit, type DB, type Row } from './db.ts';
import { fail, requireMaster, type Session } from './auth.ts';
import { fields, jsonBody, record, text, send } from './http.ts';
import { contentSchema, validateContent, type Field, type ContentPayload } from './content.ts';
import { kindFamilies, templateSnapshot } from './templates-model.ts';
import type { Config } from './config.ts';
const hash = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const fileName = /^[0-9a-f-]{36}\.webp$/;
async function download(res: ServerResponse,value: unknown) {
    const bytes=Buffer.from(JSON.stringify(value));
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});
    res.flushHeaders();
    function* chunks(){for(let offset=0;offset<bytes.length;offset+=64*1024)yield bytes.subarray(offset,offset+64*1024);}
    await pipeline(Readable.from(chunks()),res);
}
// Keep current identities, sessions and audit while restoring campaign state.
const protectedTables = new Set(['users', 'sessions', 'invites', 'auth_limits', 'schema_migrations', 'audit_log', 'archive_operation_plans', 'archive_uploads']);
async function tables(db: DB) { return await all(db, "SELECT name,sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"); }
async function schemaHash(db: DB) { return hash(JSON.stringify(await tables(db))); }
async function rows(db: DB) {
    const names=(await tables(db)).map(table=>String(table.name));
    const values=await db.batchRead(names.map(name=>`SELECT * FROM "${name}" ORDER BY rowid`));
    return Object.fromEntries(names.map((name,index)=>[name,values[index]!]));
}
function stateFingerprint(source: Record<string,Row[]>) {
    const state={...source};
    for (const name of ['sessions', 'auth_limits', 'audit_log', 'archive_operation_plans', 'archive_uploads'])
        delete state[name];
    return hash(JSON.stringify(state));
}
async function fingerprint(db: DB){return stateFingerprint(await rows(db));}
function key(config: Config) {
    if(config.storageMode==='blob'){
        const value=process.env.BACKUP_ENCRYPTION_KEY;
        if(!value)throw new Error('Configure BACKUP_ENCRYPTION_KEY.');
        const bytes=Buffer.from(value,'base64');
        if(bytes.length!==32)throw new Error('Chave de recuperação inválida.');
        return bytes;
    }
    const path = join(config.dataDir, 'backup.key');
    if (!existsSync(path))
        writeFileSync(path, randomBytes(32), { mode: 0o600, flag: 'wx' });
    const k = readFileSync(path);
    if (k.length !== 32)
        throw new Error('Chave de recuperação inválida.');
    return k;
}
type Snapshot = {
    schema: string;
    tables: Record<string, Row[]>;
    media: {
        key: string;
        bytes: string;
        sha256: string;
    }[];
};
async function snapshot(db: DB, config: Config): Promise<Snapshot> {
    const state=await rows(db);
    const keys = new Set([...state.media!, ...state.workshop_files!].map(r => String(r.storage_key)));
    return { schema: await schemaHash(db), tables: state, media: await mapAsync([...keys],async name => {
            if (!fileName.test(name))
                fail(422, 'Chave de mídia inválida no arquivo local.');
            const bytes = await privateStorage(config).read(name);
            return { key: name, bytes: bytes.toString('base64'), sha256: hash(bytes) };
        }) };
}
async function seal(db: DB, config: Config) { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(config), iv); cipher.setAAD(Buffer.from('HOGWARTS_BACKUP_V1')); const encrypted = Buffer.concat([cipher.update(JSON.stringify(await snapshot(db, config)), 'utf8'), cipher.final()]); return { format: 'HOGWARTS_PRIVATE_BACKUP', version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: encrypted.toString('base64') }; }
async function unseal(db: DB, config: Config, value: Record<string, unknown>): Promise<Snapshot> {
    fields(value, ['format', 'version', 'iv', 'tag', 'ciphertext']);
    if (value.format !== 'HOGWARTS_PRIVATE_BACKUP' || value.version !== 1)
        fail(422, 'Formato de backup incompatível.');
    let result: Snapshot;
    try {
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
    }
    if (result.schema !== await schemaHash(db)) {
        try { const upgraded=await upgradeBackupState(config,result.schema,result.tables);result={...result,...upgraded}; } catch { fail(422,'Não foi possível migrar esta cópia em segurança. Use a recuperação operacional documentada.'); }
        if(result.schema!==await schemaHash(db))fail(422,'Estrutura de backup incompatível.');
    }
    const live = (await tables(db)).map(t => String(t.name));
    if (!result.tables || Object.keys(result.tables).sort().join() !== live.sort().join() || !Array.isArray(result.media))
        fail(422, 'Estrutura de backup incompleta.');
    for (const t of live) {
        const columns = (await all(db, `PRAGMA table_info("${t}")`)).map(c => String(c.name)).sort().join();
        if (!Array.isArray(result.tables[t]) || result.tables[t]!.some(r => Object.keys(r).sort().join() !== columns || Object.values(r).some(v => v !== null && typeof v !== 'string' && typeof v !== 'number')))
            fail(422, 'Tabela de backup incompatível.');
    }
    if (result.tables.schema_migrations!.map(r => String(r.name)).sort().join() !== (await all(db, 'SELECT name FROM schema_migrations')).map(r => String(r.name)).sort().join())
        fail(422, 'A versão das migrations difere. Use a recuperação operacional documentada.');
    for (const f of result.media)
        if (!fileName.test(f.key) || hash(Buffer.from(f.bytes, 'base64')) !== f.sha256)
            fail(422, 'Mídia de backup inválida.');
    return result;
}
async function recovery(db: DB, config: Config) {
    const name=randomUUID()+'.hogwarts';
    await privateStorage(config).write(name,Buffer.from(JSON.stringify(await seal(db,config))),'recoveries');
    return name;
}
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
    templateJson?: string | null;
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
function encodePlan(config: Config,plan: Plan): Buffer {
    const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(config),iv);
    cipher.setAAD(Buffer.from('HOGWARTS_ARCHIVE_PLAN_V1'));
    const body=JSON.stringify({...plan,images:plan.images.map(image=>({...image,bytes:image.bytes.toString('base64')}))});
    const ciphertext=Buffer.concat([cipher.update(body,'utf8'),cipher.final()]);
    return Buffer.from(JSON.stringify({iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')}));
}
function decodePlan(config: Config,bytes: Buffer): Plan {
    const value=JSON.parse(bytes.toString('utf8'));
    const decipher=createDecipheriv('aes-256-gcm',key(config),Buffer.from(value.iv,'base64'));
    decipher.setAAD(Buffer.from('HOGWARTS_ARCHIVE_PLAN_V1'));decipher.setAuthTag(Buffer.from(value.tag,'base64'));
    const valuePlan=JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.ciphertext,'base64')),decipher.final()]).toString('utf8')) as Omit<Plan,'images'>&{images:(Omit<Image,'bytes'>&{bytes:string})[]};
    return {...valuePlan,images:valuePlan.images.map(image=>({...image,bytes:Buffer.from(image.bytes,'base64')}))};
}
async function remember(db: DB,config: Config,actor: Session,plan: Omit<Plan,'actor'|'expires'>) {
    const id=randomUUID(),storageKey=id+'.plan',expires=Date.now()+10*60*1000,storage=privateStorage(config);
    await storage.write(storageKey,encodePlan(config,{...plan,actor:actor.userId,expires}),'plans');
    try{
        const old=await all(db,'SELECT storage_key FROM archive_operation_plans WHERE actor_id=? OR expires_at<?',actor.userId,Date.now());
        await transaction(db,async()=>{
            await db.prepare('DELETE FROM archive_operation_plans WHERE actor_id=? OR expires_at<?').run(actor.userId,Date.now());
            await db.prepare('INSERT INTO archive_operation_plans(id,actor_id,storage_key,expires_at) VALUES(?,?,?,?)').run(id,actor.userId,storageKey,expires);
        });
        for(const row of old)await storage.remove(String(row.storage_key),'plans').catch(()=>{});
    }catch(error){await storage.remove(storageKey,'plans').catch(()=>{});throw error;}
    return {planId:id,summary:plan.summary};
}
async function loadPlan(db: DB,config: Config,actor: Session,id: string): Promise<Plan | undefined> {
    const row=await one(db,"SELECT * FROM archive_operation_plans WHERE id=? AND actor_id=? AND expires_at>? AND state='READY'",id,actor.userId,Date.now());
    if(!row)return;
    try{return decodePlan(config,await privateStorage(config).read(String(row.storage_key),'plans'));}catch{return;}
}
function imageIDs(p: ContentPayload, fields: Field[]): string[] { return fields.flatMap(f => f.type === 'image' && p[f.name] ? [String(p[f.name])] : f.type === 'blocks' ? (Array.isArray(p[f.name]) ? p[f.name] as ContentPayload[] : []).flatMap(b => imageIDs(record(b), f.fields ?? [])) : []); }
function rewrite(p: ContentPayload, definitions: Field[], ids: Map<string, string>, files: Map<string, string>): ContentPayload { return Object.fromEntries(Object.entries(p).map(([k, v]) => { const f = definitions.find(f => f.name === k); return [k, f?.type === 'blocks' && Array.isArray(v) ? v.map(b => rewrite(record(b), f.fields ?? [], ids, files)) : f?.type === 'image' && typeof v === 'string' ? files.get(v) ?? v : f?.type === 'reference' && typeof v === 'string' && !['regions', 'places', 'years'].includes(f.source ?? '') ? ids.get(v) ?? v : v]; })); }
async function insertImport(db: DB, actor: Session, records: ImportRow[], images: Image[], validated = false) {
    if(validated){
        const statements: Statement[]=[
            ...images.map(image=>({sql:'INSERT INTO workshop_files(id,owner_user_id,storage_key,mime,bytes,width,height) VALUES(?,?,?,?,?,?,?)',args:[image.id,actor.userId,image.key,'image/webp',image.bytes.length,image.width,image.height]})),
            ...records.map(row=>({sql:'INSERT INTO content_records(id,kind,owner_user_id,draft_json,draft_policy_json,private_notes,draft_template_json) VALUES(?,?,?,?,?,?,?)',args:[row.id,row.kind,actor.userId,JSON.stringify(row.payload),JSON.stringify(row.policy),row.privateNotes,row.templateJson??null]}))
        ];
        for(let offset=0;offset<statements.length;offset+=50)await db.batchWrite(statements.slice(offset,offset+50));
        for(let offset=0;offset<records.length;offset+=50){
            const ids=records.slice(offset,offset+50).map(row=>row.id);
            const created=await all(db,`SELECT * FROM content_records WHERE id IN(${ids.map(()=>'?').join(',')})`,...ids);
            const history: Statement[]=created.flatMap(row=>[
                {sql:'INSERT INTO content_revisions(record_id,version,actor_id,action,snapshot_json) VALUES(?,?,?,?,?)',args:[String(row.id),Number(row.version),actor.userId,'IMPORTED_DRAFT',JSON.stringify(row)]},
                {sql:'INSERT INTO audit_log(actor_id,action,target_type,target_id,details) VALUES(?,?,?,?,?)',args:[actor.userId,'CONTENT_IMPORTED_DRAFT',String(row.kind),String(row.id),JSON.stringify({version:row.version})]}
            ]);
            await db.batchWrite(history);
        }
        return;
    }
    for (const f of images)
        await db.prepare('INSERT INTO workshop_files(id,owner_user_id,storage_key,mime,bytes,width,height) VALUES(?,?,?,?,?,?,?)').run(f.id, actor.userId, f.key, 'image/webp', f.bytes.length, f.width, f.height);
    for (const r of records)
        await db.prepare('INSERT INTO content_records(id,kind,owner_user_id,draft_json,draft_policy_json,private_notes) VALUES(?,?,?,?,?,?)').run(r.id, r.kind, actor.userId, JSON.stringify(r.payload), JSON.stringify(r.policy), r.privateNotes);
    for (const r of records) {
        const v = await validateContent(db, r.kind, { payload: r.payload, policy: r.policy, privateNotes: r.privateNotes }), template = kindFamilies[r.kind] && r.payload.templateId ? await templateSnapshot(db, r.payload.templateId, kindFamilies[r.kind]!) : null;
        await db.prepare('UPDATE content_records SET draft_json=?,draft_policy_json=?,private_notes=?,draft_template_json=? WHERE id=?').run(JSON.stringify(v.p), JSON.stringify(v.policy), v.notes, template ? JSON.stringify(template) : null, r.id);
        r.payload=v.p;r.policy=v.policy;r.privateNotes=v.notes;r.templateJson=template?JSON.stringify(template):null;
    }
}
async function prepareImport(db: DB,config: Config,actor: Session,value: Record<string,unknown>){
    const state=await rows(db),copy=await validationDatabase(config,state);
    try{return {...await prepareImportCopy(copy,actor,value),fingerprint:stateFingerprint(state)};}finally{copy.close();}
}
async function prepareImportCopy(db: DB, actor: Session, value: Record<string, unknown>) {
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
        const exists = await one(db, 'SELECT id FROM content_records WHERE id=?', id);
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
            if (!await one(db, 'SELECT id FROM workshop_files WHERE id=?', id))
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
        if (r.payload.templateId && !await one(db, "SELECT id FROM content_records WHERE id=? AND kind='templates' AND status='PUBLISHED'", String(r.payload.templateId))) {
            r.payload.templateId = null;
            pendingTemplates.push(String(r.payload.title));
        }
    }
    // Run the complete validation on an isolated transaction and roll it back.
    const rollback=Symbol('validated');
    try{await transaction(db,async()=>{await insertImport(db,actor,records,images);throw rollback;});}
    catch(error){if(error!==rollback)throw error;}
    return { records, images, summary: { pendingTemplates, records: records.map(r => ({ sourceId: r.sourceId, id: r.id, title: r.payload.title, kind: r.kind, state: 'DRAFT' })), skipped: source.size - records.length, images: images.length, warning: 'Apenas rascunhos novos. Nenhuma publicação, revelação ou concessão.' } };
}
// Names and columns are checked against the live schema by unseal; no uploaded SQL is executed.
async function restore(db: DB, s: Snapshot, reviewedFingerprint: string, after: () => void | Promise<void>) {
    await transaction(db, async () => {
            if(await fingerprint(db)!==reviewedFingerprint)fail(409,'A campanha mudou desde a revisão. Revise novamente antes de aplicar.');
            await db.exec('PRAGMA defer_foreign_keys=ON');
            const statements: Statement[]=Object.keys(s.tables).filter(name=>!protectedTables.has(name)).map(name=>({sql:`DELETE FROM "${name}"`,args:[]}));
            for(const [name,records] of Object.entries(s.tables))if(!protectedTables.has(name))for(const row of records){
                const columns=Object.keys(row);
                statements.push({sql:`INSERT INTO "${name}"(${columns.map(column=>'"'+column+'"').join(',')}) VALUES(${columns.map(()=>'?').join(',')})`,args:columns.map(column=>row[column]??null)});
            }
            for(let offset=0;offset<statements.length;offset+=50)await db.batchWrite(statements.slice(offset,offset+50));
            if ((await all(db, 'PRAGMA foreign_key_check')).length)
                fail(422, 'O backup não é compatível com os vínculos atuais das contas.');
            await after();
        });
}
export async function handleArchives(req: IncomingMessage, res: ServerResponse, url: URL, db: DB, config: Config, session?: Session): Promise<boolean> {
    const path = url.pathname;
    if (!path.startsWith('/api/master/archives'))
        return false;
    const actor = requireMaster(session);
    if (url.searchParams.has('view_as'))
        fail(403, 'Saia da prévia para administrar arquivos.');
    const method = req.method ?? 'GET';
    if(await handleArchiveUploads(req,res,url,db,config,actor))return true;
    if (path === '/api/master/archives' && method === 'GET') {
        send(res, 200, { contentRecords: (await one(db, 'SELECT count(*) n FROM content_records'))!.n, directUpload: config.storageMode==='blob', formatVersion: 1, migrations: (await all(db, 'SELECT name FROM schema_migrations ORDER BY name')).map(r => r.name) });
        return true;
    }
    if (path === '/api/master/archives/export' && method === 'GET') {
        const records = (await all(db, 'SELECT * FROM content_records')).map(r => ({ id: r.id, kind: r.kind, payload: JSON.parse(String(r.draft_json)), policy: JSON.parse(String(r.draft_policy_json)), privateNotes: r.private_notes })), used = new Set(records.flatMap(r => imageIDs(r.payload, contentSchema(String(r.kind)).fields))), images = await mapAsync((await all(db, 'SELECT * FROM workshop_files')).filter(f => used.has(String(f.id))),async f => ({ id: f.id, bytes: (await privateStorage(config).read(String(f.storage_key))).toString('base64') }));
        res.setHeader('Content-Disposition', 'attachment; filename="hogwarts-conteudos.json"');
        await download(res, { format: 'HOGWARTS_CONTENT', version: 1, records, images });
        return true;
    }
    if (path === '/api/master/archives/backup' && method === 'GET') {
        res.setHeader('Content-Disposition', 'attachment; filename="hogwarts-backup.hogwarts"');
        await download(res, await seal(db, config));
        return true;
    }
    if (path === '/api/master/archives/prepare-import' && method === 'POST') {
        const data = await archiveInput(db,config,actor,await jsonBody(req,64*1024*1024),64*1024*1024), prepared = await prepareImport(db, config, actor, data);
        send(res, 200, await remember(db,config,actor, { ...prepared, mode: 'IMPORT' }));
        return true;
    }
    if (path === '/api/master/archives/prepare-restore' && method === 'POST') {
        const s = await unseal(db, config, await archiveInput(db,config,actor,await jsonBody(req,128*1024*1024),128*1024*1024));
        send(res, 200, await remember(db,config,actor, { fingerprint: await fingerprint(db), mode: 'RESTORE', images: [], records: [], snapshot: s, summary: { warning: 'Restaura o conteúdo, as jornadas e as mídias desta instalação. Contas, convites, sessões e auditoria atuais serão preservados.', media: s.media.length, contentRecords: s.tables.content_records?.length ?? 0 } }));
        return true;
    }
    if (path === '/api/master/archives/apply' && method === 'POST') {
        const d = await jsonBody(req);
        fields(d, ['planId', 'confirmation']);
        const id = text(d.planId, 100), plan = await loadPlan(db,config,actor,id);
        if (!plan || plan.actor !== actor.userId || plan.expires < Date.now())
            fail(409, 'Revise o arquivo novamente.');
        if (d.confirmation !== (plan.mode === 'RESTORE' ? 'RESTAURAR' : 'IMPORTAR'))
            fail(422, 'Digite a confirmação indicada.');
        if (plan.fingerprint !== await fingerprint(db))
            fail(409, 'A campanha mudou desde a revisão. Revise novamente antes de aplicar.');
        const claimed=await db.prepare("UPDATE archive_operation_plans SET state='APPLYING' WHERE id=? AND actor_id=? AND state='READY' AND expires_at>?").run(id,actor.userId,Date.now());
        if(Number(claimed.changes)!==1)fail(409,'Esta operação já está sendo aplicada. Revise novamente.');
        let safetyBackup = '';
        const written: string[] = [];
        try {
            safetyBackup = await recovery(db, config);
            if (plan.mode === 'IMPORT') {
                for (const f of plan.images) {
                    await privateStorage(config).write(f.key,f.bytes);
                    written.push(f.key);
                }
                await transaction(db, async () => { if(await fingerprint(db)!==plan.fingerprint)fail(409,'A campanha mudou desde a revisão. Revise novamente antes de aplicar.'); await insertImport(db, actor, plan.records, plan.images, true); await audit(db, actor.userId, 'ARCHIVE_IMPORT', 'ARCHIVE', id, { safetyBackup }); });
            }
            else {
                const s = plan.snapshot!;
                for (const f of s.media) {
                    const existing=await privateStorage(config).read(f.key).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
                    if (existing) {
                        if (hash(existing) !== f.sha256)
                            fail(422, 'Há conflito entre imagens de mesmo identificador.');
                    }
                    else {
                        await privateStorage(config).write(f.key,Buffer.from(f.bytes,'base64'));
                        written.push(f.key);
                    }
                }
                await restore(db, s, plan.fingerprint, async () => await audit(db, actor.userId, 'ARCHIVE_RESTORE', 'ARCHIVE', id, { safetyBackup }));
            }
        }
        catch (e) {
            for (const f of written)
                await privateStorage(config).remove(f).catch(()=>{});
            await db.prepare("UPDATE archive_operation_plans SET state='READY' WHERE id=?").run(id);
            throw e;
        }
        // The campaign transaction has committed. Cleanup failures must never
        // remove its media or make the confirmed operation eligible for replay.
        await db.prepare('DELETE FROM archive_operation_plans WHERE id=?').run(id).catch(()=>{});
        await privateStorage(config).remove(id+'.plan','plans').catch(()=>{});
        send(res, 200, { ok: true, safetyBackup });
        return true;
    }
    fail(404, 'Operação de arquivo não encontrada.');
}
