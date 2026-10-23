import { filterAsync, mapAsync } from './async-array.ts';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { all, one, transaction, audit, type DB, type Row } from './db.ts';
import { fail, requireSession, requireMaster, viewerFor, type Session } from './auth.ts';
import { fields, jsonBody, record, text, send } from './http.ts';
import { expected } from './editorial.ts';
import { registerContent, registerReference, contentPayload, contentAllowed, contentRecord, contentProject, contentRevision, type ContentPayload } from './content.ts';
import { locationVisible } from './access.ts';
import { campaignAnnouncementReference } from './campaign.ts';
const policy = { audience: 'ALL', characters: [], groups: [], houses: [], schoolYears: [], cohorts: [], excludedCharacters: [], regionId: null, locationId: null };
registerReference('boards', async (db) => (await all(db, "SELECT * FROM content_records WHERE kind='boards'")).map(r => ({ id: String(r.id), name: String(contentPayload(r, false).title) })));
registerReference('quests', async (db) => (await all(db, 'SELECT id,draft_json FROM quests')).map(r => ({ id: String(r.id), name: JSON.parse(String(r.draft_json)).title })));
registerContent('boards', { label: 'Murais', singular: 'Mural', fields: [{ name: 'title', label: 'Nome do mural', required: true, max: 180 }, { name: 'description', label: 'Descrição pública', type: 'textarea', max: 2000 }, { name: 'locationId', label: 'Local do mural', type: 'reference', source: 'places', required: true, draftOptional: true }, { name: 'houseId', label: 'Casa do mural', type: 'reference', source: 'houses' }], allowed: async (db, v, _r, p) => { const loc = await one(db, 'SELECT * FROM locations WHERE id=?', String(p.locationId)); return !!loc && await locationVisible(db, v, loc) && (!p.houseId || (await one(db, 'SELECT house_id FROM characters WHERE id=?', v.characterId))?.house_id === p.houseId); }, project: async (db, v, r, p) => ({ title: p.title, description: p.description, sections: await mapAsync((await filterAsync((await all(db, "SELECT * FROM content_records WHERE kind='notices'")), async (n) => n.published_json && contentPayload(n).boardId === r.id && await contentAllowed(db, v, n))), async (n) => { const x = await contentProject(db, v, n); return { id: n.id, title: x.title, text: [...((x.meta ?? []) as unknown[]).map(String), String(x.body)].join('\n\n'), image: x.image, alt: x.alt, links: x.links }; }), links: [{ label: 'Propor aviso', href: '/portal/avisos/' + r.id }] }) });
registerContent('notices', { label: 'Avisos publicados', singular: 'Aviso', fields: [{ name: 'title', label: 'Título do aviso', required: true, max: 180 }, { name: 'body', label: 'Texto do aviso', type: 'richtext', max: 8000 }, { name: 'boardId', label: 'Mural', type: 'reference', source: 'boards', required: true, draftOptional: true }, { name: 'authorText', label: 'Autor ou remetente', max: 180 }, { name: 'category', label: 'Categoria', max: 100 }, { name: 'narrativeDate', label: 'Data narrativa', max: 120 }, { name: 'questId', label: 'Oportunidade de missão', type: 'reference', source: 'quests', advanced: true }, { name: 'fileId', label: 'Ilustração opcional', type: 'image', advanced: true }, { name: 'alt', label: 'Texto alternativo', max: 300, advanced: true }], admin: async (db, r) => { const proposal = await one(db, 'SELECT character_id FROM board_proposals WHERE approved_record_id=?', String(r.id)); return proposal ? { authorLocked: true, authorName: (await one(db, 'SELECT name FROM characters WHERE id=?', String(proposal.character_id)))!.name } : {}; }, allowed: async (db, v, _r, p) => { const b = await one(db, "SELECT * FROM content_records WHERE id=? AND kind='boards'", String(p.boardId)); return !!b && await contentAllowed(db, v, b); }, project: async (db, v, r, p) => { const proposal = await one(db, 'SELECT character_id FROM board_proposals WHERE approved_record_id=?', String(r.id)), author = proposal ? (await one(db, 'SELECT name FROM characters WHERE id=?', String(proposal.character_id)))!.name : p.authorText, q = p.questId ? await campaignAnnouncementReference(db, v, String(p.questId)) : null; return { title: p.title, body: p.body, meta: [author, p.category, p.narrativeDate].filter(Boolean), links: q ? [{ label: 'Oportunidade: ' + q.title, href: '/portal/oportunidades/' + q.id }] : [] }; } });
const proposal = async (db: DB, id: string) => await one(db, 'SELECT * FROM board_proposals WHERE id=?', id) ?? fail(404, 'Proposta não encontrada.');
async function dto(db: DB, r: Row, master = false) { return { id: r.id, boardId: r.board_id, version: r.version, status: r.status, payload: JSON.parse(String(r.draft_json)), recordId: r.approved_record_id, publicationStatus: r.approved_record_id ? (await one(db, 'SELECT status FROM content_records WHERE id=?', String(r.approved_record_id)))?.status : null, ...(master ? { characterId: r.character_id, author: (await one(db, 'SELECT name FROM characters WHERE id=?', String(r.character_id)))!.name, privateReason: r.private_reason, recordVersion: r.approved_record_id ? (await one(db, 'SELECT version FROM content_records WHERE id=?', String(r.approved_record_id)))!.version : null } : {}) }; }
async function revision(db: DB, r: Row, actor: Session) { await db.prepare('INSERT INTO board_proposal_revisions(proposal_id,version,snapshot_json,actor_id) VALUES(?,?,?,?)').run(String(r.id), Number(r.version), JSON.stringify(r), actor.userId); await audit(db, actor.userId, 'BOARD_PROPOSAL_' + r.status, 'BOARD_PROPOSAL', String(r.id)); }
function payload(value: unknown): ContentPayload { const p = record(value); fields(p, ['title', 'body', 'category', 'narrativeDate']); return { title: text(p.title, 180), body: text(p.body, 8000), category: text(p.category, 100, false), narrativeDate: text(p.narrativeDate, 120, false) }; }
export async function handleBoards(req: IncomingMessage, res: ServerResponse, url: URL, db: DB, session?: Session): Promise<boolean> {
    const path = url.pathname, method = req.method ?? 'GET', master = path.startsWith('/api/master/boards');
    if (!master && !path.startsWith('/api/boards/proposals'))
        return false;
    const actor = requireSession(session), v = await viewerFor(db, actor, url);
    if (master) {
        requireMaster(actor);
        if (url.searchParams.has('view_as'))
            fail(403, 'Saia da prévia para moderar.');
        if (path === '/api/master/boards/proposals' && method === 'GET') {
            send(res, 200, { items: await mapAsync((await all(db, 'SELECT * FROM board_proposals ORDER BY created_at DESC,id')), async (r) => await dto(db, r, true)) });
            return true;
        }
        const match = path.match(/^\/api\/master\/boards\/proposals\/([\w-]+)\/(approve|reject)$/);
        if (match && method === 'POST') {
            const data = await jsonBody(req);
            fields(data, match[2] === 'approve' ? ['version', 'recordVersion', 'confirm'] : ['version', 'reason', 'confirm']);
            if (data.confirm !== true)
                fail(422, 'Confirme a moderação.');
            const result = await transaction(db, async () => {
                const r = await proposal(db, match[1]!);
                if (r.status === 'APPROVED' && match[2] === 'approve')
                    return await dto(db, r, true);
                expected(r, data.version);
                if (r.status !== 'SUBMITTED')
                    fail(409, 'A proposta já foi resolvida.');
                if (match[2] === 'reject')
                    await db.prepare("UPDATE board_proposals SET status='REJECTED',private_reason=?,version=version+1 WHERE id=?").run(text(data.reason, 2000), String(r.id));
                else {
                    const board = await contentRecord(db, 'boards', String(r.board_id));
                    if (board.status !== 'PUBLISHED')
                        fail(409, 'Publique o mural antes de aprovar.');
                    const p = { ...JSON.parse(String(r.draft_json)), boardId: r.board_id, authorText: (await one(db, 'SELECT name FROM characters WHERE id=?', String(r.character_id)))!.name, questId: null, fileId: null, alt: '' };
                    let id = r.approved_record_id as string | null;
                    if (id) {
                        const old = await contentRecord(db, 'notices', id);
                        expected(old, data.recordVersion);
                        if (old.draft_json !== old.published_json || old.draft_policy_json !== old.published_policy_json)
                            fail(409, 'Há uma edição do aviso pendente. Resolva antes de aprovar esta revisão.');
                        await db.prepare("UPDATE content_records SET draft_json=?,published_json=?,status='PUBLISHED',version=version+1,published_revision=version+1 WHERE id=?").run(JSON.stringify(p), JSON.stringify(p), id);
                    }
                    else {
                        id = randomUUID();
                        await db.prepare("INSERT INTO content_records(id,kind,owner_user_id,status,draft_json,draft_policy_json,published_json,published_policy_json,published_revision) VALUES(?,'notices',?,'PUBLISHED',?,?,?,?,1)").run(id, actor.userId, JSON.stringify(p), JSON.stringify(policy), JSON.stringify(p), JSON.stringify(policy));
                    }
                    await contentRevision(db, await contentRecord(db, 'notices', id), actor, 'PROPOSAL_APPROVED');
                    await db.prepare("UPDATE board_proposals SET status='APPROVED',approved_record_id=?,private_reason='',version=version+1 WHERE id=?").run(id, String(r.id));
                }
                const next = await proposal(db, String(r.id));
                await revision(db, next, actor);
                return await dto(db, next, true);
            });
            send(res, 200, result);
            return true;
        }
    }
    else {
        if (!v.characterId)
            fail(403, 'Selecione seu personagem.');
        if (path === '/api/boards/proposals' && method === 'GET') {
            send(res, 200, { items: await mapAsync((await all(db, 'SELECT * FROM board_proposals WHERE character_id=? ORDER BY created_at DESC,id', v.characterId)), async (r) => await dto(db, r)) });
            return true;
        }
        const match = path.match(/^\/api\/boards\/proposals(?:\/([\w-]+))?$/);
        if (match && ['POST', 'PATCH'].includes(method)) {
            if (actor.role !== 'PLAYER' || v.preview)
                fail(403, 'A prévia é somente leitura.');
            const data = await jsonBody(req);
            fields(data, match[1] ? ['version', 'payload'] : ['boardId', 'payload']);
            const p = payload(data.payload);
            const result = await transaction(db, async () => {
                let id = match[1], b: string;
                if (id) {
                    const r = await proposal(db, id);
                    if (r.character_id !== actor.characterId)
                        fail(404, 'Proposta não encontrada.');
                    expected(r, data.version);
                    b = String(r.board_id);
                }
                else
                    b = text(data.boardId, 100);
                const board = await contentRecord(db, 'boards', b);
                if (!await contentAllowed(db, v, board))
                    fail(404, 'Mural não encontrado.');
                if (id)
                    await db.prepare("UPDATE board_proposals SET draft_json=?,status='SUBMITTED',private_reason='',version=version+1 WHERE id=?").run(JSON.stringify(p), id);
                else {
                    id = randomUUID();
                    await db.prepare('INSERT INTO board_proposals(id,board_id,character_id,draft_json) VALUES(?,?,?,?)').run(id, b, actor.characterId!, JSON.stringify(p));
                }
                const next = await proposal(db, id);
                await revision(db, next, actor);
                return await dto(db, next);
            });
            send(res, match[1] ? 200 : 201, result);
            return true;
        }
    }
    fail(404, 'Recurso não encontrado.');
}
export async function locationBoards(db: DB, v: import('./auth.ts').Viewer, id: string) { return (await filterAsync((await all(db, "SELECT * FROM content_records WHERE kind='boards'")), async (r) => r.published_json && contentPayload(r).locationId === id && await contentAllowed(db, v, r))).map(r => ({ id: r.id, title: contentPayload(r).title })); }
