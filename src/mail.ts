import { filterAsync, forEachAsync, mapAsync } from './async-array.ts';
import { templateChoices, templateSnapshot, type TemplateSnapshot } from './templates-model.ts';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import sharp from 'sharp';
import { all, one, audit, transaction, type DB, type Row } from './db.ts';
import { fail, HttpError, requireSession, requireMaster, viewerFor, type Session, type Viewer } from './auth.ts';
import { jsonBody, bodyBuffer, fields, record, text, stringIds, send } from './http.ts';
import { expected, exists } from './editorial.ts';
import { enqueue, registerEvent } from './events.ts';
import { academicYears, knownAcademicYear, calendarHeader } from './calendar-model.ts';
import { npcReference } from './npcs.ts';
type Letter = {
    subject: string;
    body: string;
    signature: string;
    senderNpcId: string | null;
    senderName: string;
    characters: string[];
    npcs: string[];
    academicYear: string;
    style: string;
    templateId?: string | null;
    template?: TemplateSnapshot | null;
};
async function get(db: DB, id: string) { return await one(db, 'SELECT * FROM letters WHERE id=?', id) ?? fail(404, 'Carta não encontrada.'); }
function payload(r: Row): Letter { return JSON.parse(String(r.sent_json ?? r.draft_json)); }
function readable(actor: Session, v: Viewer, r: Row) { const p = payload(r); return (!v.preview && r.author_user_id === actor.userId) || (!v.preview && actor.role === 'MASTER' && r.status !== 'DRAFT') || (r.status === 'DELIVERED' && !!v.characterId && p.characters.includes(v.characterId)); }
function dto(db: DB, actor: Session, v: Viewer, r: Row) {
    if (!readable(actor, v, r))
        fail(404, 'Carta não encontrada.');
    const p = payload(r), owner = !v.preview && r.author_user_id === actor.userId, master = !v.preview && actor.role === 'MASTER';
    return { id: r.id, version: r.version, status: r.status, subject: p.subject, body: p.body, signature: p.signature, senderName: p.senderName, academicYear: p.academicYear, style: p.style, template: p.template ?? null, templateId: owner ? p.templateId ?? null : undefined, image: r.image_base64 ? '/api/mail/' + r.id + '/image' : null, owner, canEdit: owner && r.status === 'DRAFT', ...(owner || master ? { characters: p.characters, npcs: p.npcs, senderNpcId: p.senderNpcId } : {}), ...(master && r.status !== 'DRAFT' ? { privateReason: r.private_reason } : {}) };
}
async function validate(db: DB, actor: Session, value: unknown): Promise<Letter> {
    const d = record(value);
    fields(d, ['subject', 'body', 'signature', 'senderNpcId', 'characters', 'npcs', 'academicYear', 'style', 'templateId']);
    const characters = stringIds(d.characters), npcs = stringIds(d.npcs);
    await forEachAsync(characters, async (c) => await exists(db, 'characters', c));
    const available = await all(db, "SELECT * FROM npcs WHERE status='PUBLISHED'");
    for (const id of npcs) {
        const r = available.find(n => n.id === id);
        if (!r || actor.role !== 'MASTER' && !await npcReference(db, { ...actor, preview: false }, String(r.id)))
            fail(422, 'Escolha um destinatário conhecido.');
    }
    const senderNpcId = d.senderNpcId === null ? null : text(d.senderNpcId, 100);
    if (senderNpcId && actor.role !== 'MASTER')
        fail(403, 'O remetente é seu personagem.');
    const npc = senderNpcId ? await one(db, 'SELECT * FROM npcs WHERE id=?', senderNpcId) ?? fail(422, 'NPC não encontrado.') : null;
    const senderName = actor.role === 'PLAYER' ? String((await one(db, 'SELECT name FROM characters WHERE id=?', actor.characterId!))!.name) : npc ? String(JSON.parse(String(npc.draft_json)).name) : 'Remetente anônimo';
    const style = text(d.style, 30);
    if (!['PARCHMENT', 'FORMAL', 'SCRAPBOOK'].includes(style))
        fail(400, 'Modelo inválido.');
    const academicYear = text(d.academicYear, 100);
    if (!await knownAcademicYear(db, academicYear))
        fail(422, 'Ano letivo desconhecido.');
    return { subject: text(d.subject, 180, false), body: text(d.body, 16000, false), signature: text(d.signature, 200, false), senderNpcId, senderName, characters, npcs, academicYear, style, templateId: typeof d.templateId === 'string' ? d.templateId : null, template: await templateSnapshot(db, d.templateId, 'LETTER') };
}
async function history(db: DB, r: Row) { await db.prepare('INSERT INTO letter_revisions(id,letter_id,version,snapshot_json) VALUES(?,?,?,?)').run(randomUUID(), String(r.id), Number(r.version), String(r.draft_json)); }
registerEvent('LETTER', async (db, v, e) => {
    const r = await one(db, 'SELECT * FROM letters WHERE id=?', String(e.resource_id));
    if (!r || r.status !== 'DELIVERED' || !payload(r).characters.includes(v.characterId!))
        return null;
    return { title: payload(r).subject, text: 'Uma correspondência foi entregue.', href: '/portal/correio/' + r.id };
});
export async function handleMail(req: IncomingMessage, res: ServerResponse, url: URL, db: DB, session?: Session): Promise<boolean> {
    const path = url.pathname, admin = path.startsWith('/api/master/mail');
    if (!admin && !path.startsWith('/api/mail'))
        return false;
    const actor = requireSession(session), v = await viewerFor(db, actor, url), method = req.method ?? 'GET';
    if (v.preview && method !== 'GET') fail(403, 'A prévia é somente leitura.');
    if (admin) {
        requireMaster(actor);
        if (v.preview)
            fail(403, 'Saia da prévia para administrar.');
        if (path === '/api/master/mail' && method === 'GET') {
            send(res, 200, { items: (await all(db, "SELECT * FROM letters WHERE status!='DRAFT' ORDER BY rowid DESC")).map(r => dto(db, actor, v, r)) });
            return true;
        }
    }
    if (path === '/api/mail/context' && method === 'GET') {
        const master = actor.role === 'MASTER' && !v.preview;
        send(res, 200, { characters: await all(db, 'SELECT id,name FROM characters'), npcs: await mapAsync((await filterAsync((await all(db, "SELECT * FROM npcs WHERE status='PUBLISHED'")), async (r) => master || await npcReference(db, v, String(r.id)))), async (r) => ({ id: r.id, name: master ? JSON.parse(String(r.draft_json)).name : (await npcReference(db, v, String(r.id)))!.name })), templates: await templateChoices(db, 'LETTER'), academicYears: await academicYears(db), academicYear: (await calendarHeader(db)).academicYear });
        return true;
    }
    if (path === '/api/mail' && method === 'GET') {
        send(res, 200, { items: (await all(db, 'SELECT * FROM letters ORDER BY rowid DESC')).filter(r => readable(actor, v, r) && !(r.author_user_id === actor.userId && r.archived_by_author && !v.preview)).map(r => dto(db, actor, v, r)) });
        return true;
    }
    if (path === '/api/mail' && method === 'POST') {
        const d = await jsonBody(req);
        fields(d, ['payload']);
        const p = await validate(db, actor, d.payload), id = randomUUID();
        const r = await transaction(db, async () => { await db.prepare('INSERT INTO letters(id,author_user_id,sender_character_id,draft_json) VALUES(?,?,?,?)').run(id, actor.userId, actor.characterId, JSON.stringify(p)); const r = await get(db, id); await history(db, r); return r; });
        send(res, 201, dto(db, actor, v, r));
        return true;
    }
    const m = path.match(/^\/api\/(master\/)?mail\/([\w-]+)(?:\/(send|moderate|image|history|duplicate|archive))?$/);
    if (m) {
        const r = await get(db, m[2]!);
        if (!readable(actor, v, r))
            fail(404, 'Carta não encontrada.');
        const owner = !v.preview && r.author_user_id === actor.userId;
        if (method === 'GET' && !m[3]) {
            send(res, 200, dto(db, actor, v, r));
            return true;
        }
        if (method === 'GET' && m[3] === 'history') {
            if (!owner)
                fail(404, 'Histórico não encontrado.');
            send(res, 200, { items: (await all(db, 'SELECT version,snapshot_json FROM letter_revisions WHERE letter_id=? ORDER BY version DESC', String(r.id))).map(x => ({ version: x.version, payload: JSON.parse(String(x.snapshot_json)) })) });
            return true;
        }
        if (method === 'GET' && m[3] === 'image') {
            if (!r.image_base64)
                fail(404, 'Imagem não encontrada.');
            res.writeHead(200, { 'Content-Type': 'image/webp', 'Content-Disposition': 'inline; filename="carta.webp"' });
            res.end(Buffer.from(String(r.image_base64), 'base64'));
            return true;
        }
        if (method === 'POST' && m[3] === 'image') {
            if (!owner || r.status !== 'DRAFT')
                fail(403, 'Somente o autor edita o rascunho.');
            expected(r, Number(url.searchParams.get('version')));
            const input = await bodyBuffer(req, 2 * 1024 * 1024);
            let bytes: Buffer;
            try {
                const image = sharp(input, { limitInputPixels: 16000000, animated: false, failOn: 'warning' }), meta = await image.metadata();
                if (!['jpeg', 'png', 'webp'].includes(meta.format ?? '') || (meta.pages ?? 1) > 1)
                    fail(415, 'Use JPG, PNG ou WebP estático.');
                bytes = await image.autoOrient().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
            }
            catch (e) {
                if (e instanceof HttpError)
                    throw e;
                fail(400, 'Imagem inválida.');
            }
            await transaction(db, async () => { expected(await get(db, String(r.id)), Number(r.version)); await db.prepare('UPDATE letters SET image_base64=?,version=version+1 WHERE id=?').run(bytes.toString('base64'), String(r.id)); await history(db, await get(db, String(r.id))); });
            send(res, 200, dto(db, actor, v, await get(db, String(r.id))));
            return true;
        }
        if (method === 'PATCH' && !m[3]) {
            if (!owner || r.status !== 'DRAFT')
                fail(403, 'Somente o autor edita o rascunho.');
            const d = await jsonBody(req);
            fields(d, ['version', 'payload']);
            const p = await validate(db, actor, d.payload);
            await transaction(db, async () => { expected(await get(db, String(r.id)), d.version); await db.prepare('UPDATE letters SET draft_json=?,version=version+1 WHERE id=?').run(JSON.stringify(p), String(r.id)); await history(db, await get(db, String(r.id))); });
            send(res, 200, dto(db, actor, v, await get(db, String(r.id))));
            return true;
        }
        if (method === 'POST') {
            const d = await jsonBody(req);
            fields(d, ['version', 'confirm', 'status', 'reason']);
            if (d.confirm !== true)
                fail(422, 'Confirme a operação.');
            if (m[3] === 'duplicate') {
                if (!owner)
                    fail(403, 'Somente o autor duplica.');
                expected(r, d.version);
                const id = randomUUID();
                await transaction(db, async () => { await db.prepare('INSERT INTO letters(id,author_user_id,sender_character_id,draft_json,image_base64) VALUES(?,?,?,?,?)').run(id, actor.userId, actor.characterId, JSON.stringify(payload(r)), r.image_base64 ?? null); await history(db, await get(db, id)); });
                send(res, 201, dto(db, actor, v, await get(db, id)));
                return true;
            }
            await transaction(db, async () => {
                const current = await get(db, String(r.id));
                if (m[3] === 'send') {
                    if (!owner)
                        fail(403, 'Somente o autor envia.');
                    if (current.status !== 'DRAFT')
                        return;
                    expected(current, d.version);
                    const p = payload(current);
                    if (!p.body || !p.characters.length && !p.npcs.length)
                        fail(422, 'Escreva a carta e escolha destinatários.');
                    await db.prepare("UPDATE letters SET sent_json=draft_json,status='SUBMITTED',version=version+1 WHERE id=?").run(String(r.id));
                    await audit(db, actor.userId, 'LETTER_SUBMITTED', 'LETTER', String(r.id));
                }
                else if (m[3] === 'moderate' && admin) {
                    const status = text(d.status, 30);
                    if (!['HELD', 'RETURNED', 'LOST', 'DELIVERED'].includes(status))
                        fail(400, 'Estado inválido.');
                    if (current.status === 'DRAFT')
                        fail(404, 'Carta não encontrada.');
                    if (current.status === status)
                        return;
                    expected(current, d.version);
                    if (current.status === 'DELIVERED')
                        fail(409, 'A entrega já foi concluída.');
                    const reason = text(d.reason, 2000, status !== 'DELIVERED');
                    await db.prepare('UPDATE letters SET status=?,private_reason=?,version=version+1 WHERE id=?').run(status, reason, String(r.id));
                    if (status === 'DELIVERED')
                        for (const char of payload(current).characters)
                            await enqueue(db, char, 'LETTER', String(r.id), null, 'ANIMATED');
                    await audit(db, actor.userId, 'LETTER_' + status, 'LETTER', String(r.id), { reason });
                }
                else if (m[3] === 'archive' && owner) {
                    expected(current, d.version);
                    await db.prepare('UPDATE letters SET archived_by_author=1,version=version+1 WHERE id=?').run(String(r.id));
                }
                else
                    fail(404, 'Ação não encontrada.');
            });
            send(res, 200, dto(db, actor, v, await get(db, String(r.id))));
            return true;
        }
    }
    fail(404, 'Recurso não encontrado.');
}
