import { mapAsync } from './async-array.ts';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { all, one, transaction, audit, type DB, type Row } from './db.ts';
import { fail, digest, requireMaster, requireSession, viewerFor, type Session } from './auth.ts';
import { fields, jsonBody, stringIds, text, send } from './http.ts';
import { expected, exists, policyAllows } from './editorial.ts';
import { registerContent, registerReference, contentRecord, contentPayload, contentPolicy, contentAllowed, contentRevision, contentAdmin, contentProject, type Field, type ContentPayload } from './content.ts';
import { libraryPages, libraryValidate, libraryAdmin, libraryPageAction, pageFields, registerProgressiveKind } from './library.ts';
import { enqueue, registerEvent } from './events.ts';
import { registerReward } from './documents.ts';
import { renderImage } from './workshop.ts';
import type { Config } from './config.ts';
export const collectionKinds = ['chocolatecards', 'bestiary', 'rarities', 'memories', 'curiosities'];
const names: Record<string, [
    string,
    string
]> = { chocolatecards: ['Sapos de Chocolate', 'Carta'], bestiary: ['Bestiário Encantado', 'Espécie'], rarities: ['Biblioteca de Raridades', 'Raridade'], memories: ['Recordações', 'Recordação'], curiosities: ['Gabinete de Curiosidades', 'Curiosidade'] };
const defaultPolicy = { audience: 'ALL', characters: [], groups: [], houses: [], schoolYears: [], cohorts: [], excludedCharacters: [], regionId: null, locationId: null };
export async function collectionDiscovery(db: DB, id: string, char: string) { return await one(db, 'SELECT * FROM collection_discoveries WHERE record_id=? AND character_id=? AND active=1', id, char); }
export function collectionSnapshot(p: ContentPayload, personalText = ''): ContentPayload { return Object.fromEntries(['title', 'description', 'fileId', 'alt', 'rarity', 'season', 'bookId', 'narrativeDate', 'classification', 'presentation', 'template'].filter(k => p[k] !== undefined).map(k => [k, p[k]]).concat([['personalText', personalText]])); }
export async function discoverCollection(db: DB, actor: Session, row: Row, char: string, options: {
    presentation?: string;
    personalText?: string;
    observed?: boolean;
    snapshot?: ContentPayload;
    historical?: boolean;
} = {}) {
    await exists(db, 'characters', char);
    if (!row.published_json || row.status !== 'PUBLISHED' && !(options.historical && options.snapshot))
        fail(422, 'Publique o conteúdo antes de revelar.');
    if (!await policyAllows(db, { role: 'PLAYER', userId: actor.userId, characterId: char, preview: false }, contentPolicy(row)))
        fail(422, 'Um destinatário não pode consultar este conteúdo.');
    if (row.kind === 'bestiary' && !options.observed)
        fail(422, 'Confirme o encontro presenciado e seus observadores.');
    const previous = await one(db, 'SELECT snapshot_json FROM collection_discoveries WHERE record_id=? AND character_id=?', String(row.id), char);
    const previousText = previous ? JSON.parse(String(previous.snapshot_json)).personalText : '';
    const snapshot = options.snapshot ?? { ...collectionSnapshot(contentPayload(row), options.personalText ?? previousText ?? ''), template: JSON.parse(String(row.published_template_json ?? 'null')) }, event = await enqueue(db, char, 'COLLECTION_DISCOVERY', String(row.id), null, options.presentation ?? 'ANIMATED');
    await db.prepare('INSERT INTO collection_discoveries(record_id,character_id,snapshot_json,source_revision,event_id,actor_id) VALUES(?,?,?,?,?,?) ON CONFLICT(record_id,character_id) DO UPDATE SET active=1,snapshot_json=excluded.snapshot_json,source_revision=excluded.source_revision,event_id=excluded.event_id,actor_id=excluded.actor_id').run(String(row.id), char, JSON.stringify(snapshot), Number(row.published_revision), event, actor.userId);
    await db.prepare('INSERT INTO collection_reveal_history(id,record_id,character_id,action,snapshot_json,actor_id) VALUES(?,?,?,?,?,?)').run(randomUUID(), String(row.id), char, 'DISCOVER', JSON.stringify(snapshot), actor.userId);
    return snapshot;
}
async function operation(db: DB, actor: Session, row: Row, action: string, data: Record<string, unknown>) {
    if (['reveal-pages', 'revoke-pages'].includes(action)) {
        if (action === 'reveal-pages')
            for (const char of stringIds(data.characters))
                if (!await collectionDiscovery(db, String(row.id), char))
                    fail(422, 'Revele primeiro o registro aos destinatários.');
        return await libraryPageAction(db, actor, row, action, data);
    }
    if (!['discover', 'withdraw-discovery'].includes(action))
        fail(404, 'Ação não encontrada.');
    fields(data, ['version', 'characters', 'presentation', 'personalText', 'observed', 'encounter']);
    const chars = stringIds(data.characters);
    if (!chars.length)
        fail(422, 'Escolha destinatários.');
    const reveal = action === 'discover';
    if (reveal && !['ANIMATED', 'SILENT'].includes(String(data.presentation)))
        fail(400, 'Escolha a apresentação.');
    const personalText = text(data.personalText ?? '', 4000, false);
    if (row.kind === 'bestiary' && reveal) {
        if (data.observed !== true)
            fail(422, 'Confirme que os observadores presenciaram o encontro.');
        text(data.encounter??'', 2000, false);
    }
    for (const char of chars) {
        await exists(db, 'characters', char);
        if (reveal)
            await discoverCollection(db, actor, row, char, { presentation: String(data.presentation), personalText, observed: row.kind === 'bestiary' && data.observed === true });
        else
            await db.prepare('UPDATE collection_discoveries SET active=0 WHERE record_id=? AND character_id=?').run(String(row.id), char);
    }
    await db.prepare('UPDATE content_records SET version=version+1 WHERE id=?').run(String(row.id));
    const next = await contentRecord(db, String(row.kind), String(row.id));
    await contentRevision(db, next, actor, action.toUpperCase());
    await audit(db, actor.userId, 'COLLECTION_' + action.toUpperCase(), String(row.kind), String(row.id), { characters: chars, encounter: row.kind === 'bestiary' ? data.encounter : null });
    return await contentAdmin(db, next);
}
const common: Field[] = [{ name: 'title', label: 'Nome', required: true, max: 180 }, { name: 'description', label: 'Apresentação revelada', type: 'richtext', max: 8000 }, { name: 'fileId', label: 'Imagem opcional', type: 'image', advanced: true }, { name: 'alt', label: 'Texto alternativo', max: 300, advanced: true }];
for (const kind of collectionKinds) {
    registerProgressiveKind(kind);
    registerContent(kind, { label: names[kind]![0], singular: names[kind]![1], retainArchive: true, imageField: '__discoveryImage', fields: [...common, ...(kind === 'chocolatecards' ? [{ name: 'rarity', label: 'Raridade', type: 'select', options: ['COMMON', 'UNCOMMON', 'RARE', 'LEGENDARY'], required: true }, { name: 'season', label: 'Temporada (opcional)', max: 100 }, { name: 'eligible', label: 'Elegível para pacotes', type: 'checkbox' }] as Field[] : kind === 'bestiary' ? [{ name: 'classification', label: 'Classificação', max: 180 }, { name: 'notableIndividuals', label: 'Indivíduos notáveis (planejamento privado)', type: 'textarea', max: 4000, advanced: true }] as Field[] : kind === 'rarities' ? [{ name: 'bookId', label: 'Obra extraordinária', type: 'reference', source: 'books' }] as Field[] : kind === 'memories' ? [{ name: 'narrativeDate', label: 'Data da recordação', max: 120 }] as Field[] : [{ name: 'itemId', label: 'Item relacionado (não concede posse)', type: 'reference', source: 'items' }] as Field[]), ...(kind === 'rarities' ? [] : [{ name: 'pages', label: 'Informações por camadas', type: 'blocks', fields: pageFields.map(f => ({ ...f, label: ({ title: 'Título da camada', text: 'Conteúdo da camada', fileId: 'Ilustração da camada', alt: 'Texto alternativo da camada', policy: 'Restrições da camada' } as Record<string, string>)[f.name] ?? f.label })), max: 50 }] as Field[])], validate: (db, p) => {
            if (p.fileId && !p.alt)
                fail(422, 'Preencha o texto alternativo.');
            if (kind !== 'rarities')
                libraryValidate(db, p);
        }, published: async (db, row) => {
            if (kind === 'rarities' && contentPayload(row).bookId) {
                const book = await contentRecord(db, 'books', String(contentPayload(row).bookId));
                if (book.status !== 'PUBLISHED' || contentPayload(book).category !== 'RARE')
                    fail(422, 'Publique a obra como Raridade antes de publicar a coleção.');
            }
        }, duplicate: p => ({ ...p, ...(kind === 'rarities' ? {} : { pages: (p.pages as Record<string, unknown>[]).map(page => ({ ...page, id: randomUUID() })) }) }), admin: async (db, row) => ({ ...await libraryAdmin(db, row), discoveries: await all(db, 'SELECT character_id,active,source_revision FROM collection_discoveries WHERE record_id=?', String(row.id)), history: await all(db, 'SELECT character_id,action,snapshot_json,created_at FROM collection_reveal_history WHERE record_id=? ORDER BY rowid DESC LIMIT 30', String(row.id)), bookId: kind === 'rarities' ? contentPayload(row, false).bookId : null }), action: operation, allowed: async (db, v, r) => !!v.characterId && !!await collectionDiscovery(db, String(r.id), v.characterId), project: async (db, v, r) => { const d = (await collectionDiscovery(db, String(r.id), v.characterId!))!, p = JSON.parse(String(d.snapshot_json)) as ContentPayload, book = p.bookId ? await one(db, "SELECT * FROM content_records WHERE id=? AND kind='books'", String(p.bookId)) : null; return { template: p.template ?? null, title: p.title, description: [p.description, p.personalText].filter(Boolean).join('\n\n'), meta: [p.rarity ? ({ COMMON: 'Comum', UNCOMMON: 'Incomum', RARE: 'Rara', LEGENDARY: 'Lendária' } as Record<string, string>)[String(p.rarity)] : null, p.season, p.narrativeDate, p.classification].filter(Boolean), sections: kind === 'rarities' ? [] : await libraryPages(db, v, r), image: p.fileId ? `/api/collections/${r.id}/image?stamp=${digest(String(d.snapshot_json)).slice(0, 20)}` : null, alt: p.alt ?? '', links: [{ label: 'Minhas anotações', href: '/portal/colecao/' + r.id }, ...(book && await contentAllowed(db, v, book) ? [{ label: 'Ler obra vinculada', href: '/portal/conteudos/books/' + book.id }] : [])] }; } });
}
registerReference('collections', async (db) => (await all(db, "SELECT * FROM content_records WHERE kind IN('chocolatecards','bestiary','rarities','memories','curiosities')")).map(r => ({ id: String(r.id), name: String(contentPayload(r, false).title) })));
registerEvent('COLLECTION_DISCOVERY', async (db, v, event) => {
    const row = await one(db, 'SELECT * FROM content_records WHERE id=?', String(event.resource_id));
    if (!row || !collectionKinds.includes(String(row.kind)) || !await contentAllowed(db, v, row))
        return null;
    const d = await collectionDiscovery(db, String(row.id), v.characterId!);
    if (!d || d.event_id !== event.id)
        return null;
    const p = JSON.parse(String(d.snapshot_json));
    return { kind: ({bestiary:'NOVA CRIATURA DESCOBERTA',memories:'NOVA RECORDAÇÃO',chocolatecards:'NOVA CARTA DE SAPO',curiosities:'NOVA CURIOSIDADE',rarities:'NOVA RARIDADE'} as Record<string,string>)[String(row.kind)], title: p.title, text: [p.description, p.personalText].filter(Boolean).join('\n\n'), image: p.fileId ? `/api/collections/${row.id}/image?stamp=${digest(String(d.snapshot_json)).slice(0, 20)}` : null, alt: p.alt ?? '', href: '/portal/conteudos/' + row.kind + '/' + row.id };
});
for (const rewardKind of ['COLLECTION', 'MEMORY'])
    registerReward(rewardKind, { validate: async (db, p) => {
            const r = await one(db, 'SELECT * FROM content_records WHERE id=?', p.referenceId);
            if (!r || !collectionKinds.includes(String(r.kind)) || rewardKind === 'MEMORY' && r.kind !== 'memories')
                fail(422, 'Escolha uma coleção válida para esta recompensa.');
        }, apply: async (db, actor, p, char) => {
            const r = (await one(db, 'SELECT * FROM content_records WHERE id=?', p.referenceId))!;
            if (r.kind === 'bestiary') {
                if (!await collectionDiscovery(db, String(r.id), char) || !await contentAllowed(db, { role: 'PLAYER', userId: actor.userId, characterId: char, preview: false }, r))
                    fail(422, 'Confirme o encontro no Bestiário antes desta concessão.');
            }
            else
                await discoverCollection(db, actor, r, char, { presentation: 'SILENT', ...(rewardKind === 'MEMORY' ? { personalText: p.text } : {}) });
            const d = (await collectionDiscovery(db, String(r.id), char))!, known = JSON.parse(String(d.snapshot_json));
            return { kind: rewardKind, title: known.title, text: p.text, referenceId: r.id };
        } });
function proposalDTO(r: Row, master = false) { return { id: r.id, version: r.version, status: r.status, payload: JSON.parse(String(r.payload_json)), recordId: r.record_id, ...(master ? { characterId: r.character_id, privateReason: r.private_reason } : {}) }; }
export async function handleCollections(req: IncomingMessage, res: ServerResponse, url: URL, db: DB, config: Config, session?: Session): Promise<boolean> {
    const path = url.pathname, method = req.method ?? 'GET', master = path.startsWith('/api/master/collections');
    if (!master && !path.startsWith('/api/collections'))
        return false;
    const actor = requireSession(session), v = await viewerFor(db, actor, url);
    if (master) {
        requireMaster(actor);
        if (url.searchParams.has('view_as'))
            fail(403, 'Saia da prévia para administrar.');
        if (path === '/api/master/collections/proposals' && method === 'GET') {
            send(res, 200, { items: await mapAsync((await all(db, 'SELECT * FROM curiosity_proposals')), async (r) => ({ ...proposalDTO(r, true), author: (await one(db, 'SELECT name FROM characters WHERE id=?', String(r.character_id)))!.name })) });
            return true;
        }
        const match = path.match(/^\/api\/master\/collections\/proposals\/([\w-]+)\/(approve|reject)$/);
        if (match && method === 'POST') {
            const data = await jsonBody(req);
            fields(data, ['version', 'confirm', 'reason']);
            if (data.confirm !== true)
                fail(422, 'Confirme a decisão.');
            const result = await transaction(db, async () => {
                const r = await one(db, 'SELECT * FROM curiosity_proposals WHERE id=?', match[1]!) ?? fail(404, 'Proposta não encontrada.');
                if (r.status === 'APPROVED' && match[2] === 'approve')
                    return proposalDTO(r, true);
                expected(r, data.version);
                if (r.status !== 'SUBMITTED')
                    fail(409, 'Proposta já resolvida.');
                let id: string | null = null;
                if (match[2] === 'approve') {
                    id = randomUUID();
                    const p = { ...JSON.parse(String(r.payload_json)), fileId: null, alt: '', itemId: null, pages: [] };
                    await db.prepare("INSERT INTO content_records(id,kind,owner_user_id,draft_json,draft_policy_json,private_notes) VALUES(?,'curiosities',?,?,?,'Criação de jogador aprovada; publicar e revelar são ações distintas.')").run(id, actor.userId, JSON.stringify(p), JSON.stringify(defaultPolicy));
                    await contentRevision(db, await contentRecord(db, 'curiosities', id), actor, 'PROPOSAL_APPROVED');
                }
                await db.prepare('UPDATE curiosity_proposals SET status=?,record_id=?,private_reason=?,version=version+1 WHERE id=?').run(match[2] === 'approve' ? 'APPROVED' : 'REJECTED', id, match[2] === 'reject' ? text(data.reason, 2000) : '', String(r.id));
                await audit(db, actor.userId, 'CURIOSITY_PROPOSAL_' + match[2]!.toUpperCase(), 'CURIOSITY_PROPOSAL', String(r.id));
                return proposalDTO((await one(db, 'SELECT * FROM curiosity_proposals WHERE id=?', String(r.id)))!, true);
            });
            send(res, 200, result);
            return true;
        }
    }
    else {
        if (path === '/api/collections/proposals') {
            if (method === 'GET') {
                if (actor.role !== 'PLAYER' || v.preview)
                    fail(403, 'Propostas pessoais pertencem ao autor.');
                send(res, 200, { items: (await all(db, 'SELECT * FROM curiosity_proposals WHERE character_id=?', actor.characterId)).map(r => proposalDTO(r)) });
                return true;
            }
            if (method === 'POST') {
                if (actor.role !== 'PLAYER' || v.preview)
                    fail(403, 'A prévia é somente leitura.');
                const data = await jsonBody(req);
                fields(data, ['title', 'description']);
                const p = { title: text(data.title, 180), description: text(data.description, 8000) };
                const id = randomUUID();
                await transaction(db, async () => { await db.prepare('INSERT INTO curiosity_proposals(id,character_id,payload_json) VALUES(?,?,?)').run(id, actor.characterId!, JSON.stringify(p)); await audit(db, actor.userId, 'CURIOSITY_PROPOSED', 'CURIOSITY_PROPOSAL', id); });
                send(res, 201, proposalDTO((await one(db, 'SELECT * FROM curiosity_proposals WHERE id=?', id))!));
                return true;
            }
        }
        const direct = path.match(/^\/api\/collections\/([\w-]+)$/);
        if (direct && method === 'GET') {
            const row = await one(db, 'SELECT * FROM content_records WHERE id=?', direct[1]!) ?? fail(404, 'Registro não encontrado.');
            if (!collectionKinds.includes(String(row.kind)) || !await contentAllowed(db, v, row))
                fail(404, 'Registro não encontrado.');
            send(res, 200, await contentProject(db, v, row));
            return true;
        }
        const match = path.match(/^\/api\/collections\/([\w-]+)\/(image|note)$/);
        if (match) {
            const row = await one(db, 'SELECT * FROM content_records WHERE id=?', match[1]!) ?? fail(404, 'Registro não encontrado.');
            if (!collectionKinds.includes(String(row.kind)) || !await contentAllowed(db, v, row))
                fail(404, 'Registro não encontrado.');
            if (match[2] === 'image' && method === 'GET') {
                const d = (await collectionDiscovery(db, String(row.id), v.characterId!))!, p = JSON.parse(String(d.snapshot_json));
                if (!p.fileId || url.searchParams.get('stamp') !== digest(String(d.snapshot_json)).slice(0, 20))
                    fail(404, 'Imagem indisponível.');
                await renderImage(db, config, res, { fileId: p.fileId, crop: { x: 0, y: 0, width: 100, height: 100 } }, false);
                return true;
            }
            if (match[2] === 'note') {
                if (actor.role !== 'PLAYER' || v.preview || actor.characterId !== v.characterId)
                    fail(403, 'Anotações pessoais pertencem ao autor.');
                const old = await one(db, 'SELECT version,body FROM collection_notes WHERE record_id=? AND character_id=?', String(row.id), actor.characterId);
                if (method === 'GET') {
                    send(res, 200, old ?? { version: 0, body: '' });
                    return true;
                }
                if (method === 'PUT') {
                    const data = await jsonBody(req);
                    fields(data, ['version', 'body']);
                    const body = text(data.body, 8000, false);
                    await transaction(db, async () => {
                        const current = await one(db, 'SELECT version FROM collection_notes WHERE record_id=? AND character_id=?', String(row.id), actor.characterId);
                        if (data.version !== (current?.version ?? 0))
                            fail(409, 'A anotação foi alterada em outra sessão.');
                        await db.prepare('INSERT INTO collection_notes(record_id,character_id,body) VALUES(?,?,?) ON CONFLICT(record_id,character_id) DO UPDATE SET body=excluded.body,version=version+1').run(String(row.id), actor.characterId!, body);
                    });
                    send(res, 200, { ok: true });
                    return true;
                }
            }
        }
    }
    fail(404, 'Recurso não encontrado.');
}
