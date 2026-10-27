import { forEachAsync, mapAsync } from './async-array.ts';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { all, one, audit, transaction, type DB, type Row } from './db.ts';
import { fail, requireSession, requireMaster, viewerFor, type Session, type Viewer } from './auth.ts';
import { fields, jsonBody, text, stringIds, send } from './http.ts';
import { expected, exists } from './editorial.ts';
import { enqueue, registerEvent } from './events.ts';
const get = async (db: DB, id: string) => await one(db, 'SELECT * FROM investigation_cases WHERE id=?', id) ?? fail(404, 'Caso não encontrado.');
const members = (r: Row) => JSON.parse(String(r.members_json)) as string[];
const allowed = (v: Viewer, r: Row) => v.role === 'MASTER' && !v.preview || !!v.characterId && members(r).includes(v.characterId);
async function dto(db: DB, v: Viewer, r: Row) { const master = v.role === 'MASTER' && !v.preview; return { id: r.id, title: r.title, summary: r.summary, status: r.status, version: r.version, ownerCharacterId: r.owner_character_id, members: members(r), notes: await mapAsync((await all(db, 'SELECT * FROM investigation_notes WHERE case_id=? ORDER BY rowid', String(r.id))).filter(n => master || !n.hidden), async (n) => ({ id: n.id, body: n.body, version: n.version, characterId: n.character_id, author: (await one(db, 'SELECT name FROM characters WHERE id=?', String(n.character_id)))!.name, hidden: !!n.hidden, own: !v.preview && v.userId === n.author_user_id })), ...(master ? { privateWarning: r.private_warning } : {}), canEdit: !v.preview && v.characterId === r.owner_character_id }; }
async function revision(db: DB, actor: Session, r: Row, action: string) { await db.prepare('INSERT INTO investigation_revisions(id,case_id,actor_id,action,snapshot_json) VALUES(?,?,?,?,?)').run(randomUUID(), String(r.id), actor.userId, action, JSON.stringify({ case: r, notes: await all(db, 'SELECT * FROM investigation_notes WHERE case_id=?', String(r.id)) })); await audit(db, actor.userId, 'INVESTIGATION_' + action, 'CASE', String(r.id)); }
async function notify(db: DB, r: Row) {
    for (const char of members(r))
        await enqueue(db, char, 'INVESTIGATION', String(r.id), null, 'SILENT');
}
registerEvent('INVESTIGATION', async (db, v, e) => { const r = await one(db, 'SELECT * FROM investigation_cases WHERE id=?', String(e.resource_id)); return r && allowed(v, r) ? { title: String(r.title), text: 'O caderno coletivo foi atualizado.', href: '/portal/investigacoes/' + r.id } : null; });
export async function handleInvestigations(req: IncomingMessage, res: ServerResponse, url: URL, db: DB, session?: Session): Promise<boolean> {
    const path = url.pathname, admin = path.startsWith('/api/master/investigations');
    if (!admin && !path.startsWith('/api/investigations'))
        return false;
    const actor = requireSession(session), v = await viewerFor(db, actor, url), method = req.method ?? 'GET';
    if (admin) {
        requireMaster(actor);
        if (v.preview)
            fail(403, 'Saia da prévia para moderar.');
    }
    const base = admin ? '/api/master/investigations' : '/api/investigations';
    if (path === base + '/context' && method === 'GET') {
        send(res, 200, { characters: await all(db, 'SELECT id,name FROM characters') });
        return true;
    }
    if (path === base && method === 'GET') {
        const q = (url.searchParams.get('q') ?? '').slice(0, 120).toLocaleLowerCase('pt-BR');
        send(res, 200, { items: await mapAsync((await all(db, 'SELECT * FROM investigation_cases ORDER BY rowid DESC')).filter(r => allowed(v, r) && (!q || (r.title + ' ' + r.summary).toLocaleLowerCase('pt-BR').includes(q))), async (r) => await dto(db, v, r)) });
        return true;
    }
    if (path === base && method === 'POST') {
        if (actor.role !== 'PLAYER' || v.preview)
            fail(403, 'Os jogadores criam os casos.');
        const d = await jsonBody(req);
        fields(d, ['title', 'summary', 'members', 'confirm']);
        if (d.confirm !== true)
            fail(422, 'Confirme o compartilhamento.');
        const chars = stringIds(d.members);
        if (!chars.includes(actor.characterId!))
            fail(422, 'Inclua seu personagem no caso.');
        await forEachAsync(chars, async (c) => await exists(db, 'characters', c));
        const title = text(d.title, 180), summary = text(d.summary, 4000, false), id = randomUUID();
        await transaction(db, async () => { await db.prepare('INSERT INTO investigation_cases(id,owner_character_id,members_json,title,summary) VALUES(?,?,?,?,?)').run(id, actor.characterId!, JSON.stringify(chars), title, summary); await revision(db, actor, await get(db, id), 'CREATED'); await notify(db, await get(db, id)); });
        send(res, 201, await dto(db, v, await get(db, id)));
        return true;
    }
    const m = path.match(/^\/api\/(?:master\/)?investigations\/([\w-]+)(?:\/(notes|moderate|history)(?:\/([\w-]+))?)?$/);
    if (m) {
        const r = await get(db, m[1]!);
        if (!allowed(v, r))
            fail(404, 'Caso não encontrado.');
        if (method === 'GET' && !m[2]) {
            send(res, 200, await dto(db, v, r));
            return true;
        }
        if (method === 'GET' && m[2] === 'history' && admin) {
            send(res, 200, { items: (await all(db, 'SELECT action,snapshot_json FROM investigation_revisions WHERE case_id=? ORDER BY rowid DESC', String(r.id))).map(x => ({ action: x.action, snapshot: JSON.parse(String(x.snapshot_json)) })) });
            return true;
        }
        if (method === 'POST' || method === 'PATCH') {
            const d = await jsonBody(req);
            if (d.confirm !== true)
                fail(422, 'Confirme a alteração compartilhada.');
            await transaction(db, async () => {
                const current = await get(db, String(r.id));
                if (m[2] === 'moderate' && admin) {
                    fields(d, ['version', 'confirm', 'status', 'warning', 'noteId', 'hidden']);
                    expected(current, d.version);
                    const status = text(d.status, 30);
                    if (!['OPEN', 'ARCHIVED'].includes(status))
                        fail(400, 'Estado inválido.');
                    const warning = text(d.warning, 4000, false);
                    if (d.noteId !== null) {
                        const n = await one(db, 'SELECT * FROM investigation_notes WHERE id=? AND case_id=?', text(d.noteId, 100), String(r.id)) ?? fail(404, 'Contribuição não encontrada.');
                        if (typeof d.hidden !== 'boolean')
                            fail(400, 'Escolha a moderação.');
                        await db.prepare('UPDATE investigation_notes SET hidden=?,version=version+1 WHERE id=?').run(d.hidden ? 1 : 0, String(n.id));
                    }
                    await db.prepare('UPDATE investigation_cases SET status=?,private_warning=?,version=version+1 WHERE id=?').run(status, warning, String(r.id));
                    await revision(db, actor, await get(db, String(r.id)), 'MODERATED');
                }
                else {
                    if (actor.role !== 'PLAYER' || v.preview)
                        fail(403, 'Contribuições pertencem aos jogadores.');
                    if (current.status !== 'OPEN')
                        fail(409, 'Caso arquivado: somente leitura.');
                    if (!m[2]) {
                        fields(d, ['version', 'title', 'summary', 'members', 'confirm']);
                        if (current.owner_character_id !== actor.characterId)
                            fail(403, 'Somente o criador edita os participantes.');
                        expected(current, d.version);
                        const chars = stringIds(d.members);
                        if (!chars.includes(actor.characterId!))
                            fail(422, 'O criador precisa continuar no caso.');
                        await forEachAsync(chars, async (c) => await exists(db, 'characters', c));
                        await db.prepare('UPDATE investigation_cases SET title=?,summary=?,members_json=?,version=version+1 WHERE id=?').run(text(d.title, 180), text(d.summary, 4000, false), JSON.stringify(chars), String(r.id));
                        await revision(db, actor, await get(db, String(r.id)), 'EDITED');
                    }
                    else if (m[2] === 'notes') {
                        fields(d, ['version', 'body', 'confirm']);
                        const body = text(d.body, 8000);
                        if (m[3]) {
                            const n = await one(db, 'SELECT * FROM investigation_notes WHERE id=? AND case_id=?', m[3], String(r.id)) ?? fail(404, 'Contribuição não encontrada.');
                            if (n.author_user_id !== actor.userId || n.hidden)
                                fail(403, 'Somente o autor edita sua contribuição visível.');
                            expected(n, d.version);
                            await db.prepare('UPDATE investigation_notes SET body=?,version=version+1 WHERE id=?').run(body, String(n.id));
                        }
                        else {
                            expected(current, d.version);
                            await db.prepare('INSERT INTO investigation_notes(id,case_id,author_user_id,character_id,body) VALUES(?,?,?,?,?)').run(randomUUID(), String(r.id), actor.userId, actor.characterId!, body);
                        }
                        await db.prepare('UPDATE investigation_cases SET version=version+1 WHERE id=?').run(String(r.id));
                        await revision(db, actor, await get(db, String(r.id)), 'CONTRIBUTED');
                    }
                    else
                        fail(404, 'Ação não encontrada.');
                }
                await notify(db, await get(db, String(r.id)));
            });
            send(res, 200, await dto(db, v, await get(db, String(r.id))));
            return true;
        }
    }
    fail(404, 'Recurso não encontrado.');
}
