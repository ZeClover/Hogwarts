import { filterAsync, flatMapAsync, mapAsync } from './async-array.ts';
import { randomUUID, randomInt } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { all, one, transaction, audit, type DB, type Row } from './db.ts';
import { fail, requireMaster, requireSession, viewerFor, type Session, type Viewer } from './auth.ts';
import { fields, jsonBody, stringIds, text, send } from './http.ts';
import { expected, exists, policyAllows, type Policy } from './editorial.ts';
import { registerContent, registerReference, contentRecord, contentPayload, contentPolicy, contentAllowed, type ContentPayload, type Field } from './content.ts';
import { discoverCollection, collectionSnapshot } from './collections.ts';
export const rarities = ['COMMON', 'UNCOMMON', 'RARE', 'LEGENDARY'];
const weightNames = ['commonWeight', 'uncommonWeight', 'rareWeight', 'legendaryWeight'];
const rarityNames = ['Comum', 'Incomum', 'Rara', 'Lendária'];
type FrozenCard = {
    id: string;
    base: ContentPayload;
    policy: Policy;
};
export type FrozenPool = {
    groups: {
        rarity: string;
        weight: number;
        cards: FrozenCard[];
    }[];
};
async function candidates(db: DB, p: ContentPayload, v?: Viewer) { return await filterAsync((await all(db, "SELECT * FROM content_records WHERE kind='chocolatecards' AND status='PUBLISHED'")), async (r) => { const card = contentPayload(r); return card.eligible && card.season === p.season && (!v || await policyAllows(db, v, contentPolicy(r))); }); }
async function frozen(db: DB, p: ContentPayload, v?: Viewer): Promise<FrozenPool> { const cards = await candidates(db, p, v); return { groups: rarities.map((rarity, i) => ({ rarity, weight: Number(p[weightNames[i]!]), cards: cards.filter(r => contentPayload(r).rarity === rarity).map(r => ({ id: String(r.id), base: { ...collectionSnapshot(contentPayload(r)), template: JSON.parse(String(r.published_template_json ?? 'null')) }, policy: contentPolicy(r) })) })).filter(g => g.weight > 0) }; }
function validPool(pool: FrozenPool) {
    if (!pool.groups.length || pool.groups.length > 4 || new Set(pool.groups.map(g => g.rarity)).size !== pool.groups.length || pool.groups.some(g => !rarities.includes(g.rarity) || !Number.isSafeInteger(g.weight) || g.weight <= 0 || g.weight > 1e6 || !g.cards.length))
        fail(422, 'Cada raridade com peso positivo precisa ter cartas publicadas, elegíveis e autorizadas.');
}
export function drawCard(pool: FrozenPool, rng: (max: number) => number = randomInt) {
    validPool(pool);
    const total = pool.groups.reduce((n, g) => n + g.weight, 0), ticket = rng(total);
    let running = 0;
    for (const group of pool.groups) {
        running += group.weight;
        if (ticket < running)
            return group.cards[rng(group.cards.length)]!;
    }
    throw new Error('Sorteio fora do intervalo.');
}
registerContent('chocolatepools', { label: 'Pools e probabilidades de Sapos', singular: 'Pool de Sapos', fields: [{ name: 'title', label: 'Nome do pool', required: true, max: 180 }, { name: 'season', label: 'Temporada', required: true, draftOptional: true, max: 100 }, ...weightNames.map((name, i) => ({ name, label: 'Peso ' + rarityNames[i], type: 'number', required: true, draftOptional: true, min: 0, max: 1000000 } as Field))], validate: (_db, p) => {
        if (weightNames.some(k => p[k] === null)) return;
        if (weightNames.reduce((n, k) => n + Number(p[k]), 0) <= 0)
            fail(422, 'Informe pelo menos um peso positivo.');
    }, published: async (db, r) => validPool(await frozen(db, contentPayload(r))), allowed: () => false, project: (_db, _v, _r, p) => ({ title: p.title }), admin: async (db, r) => { const p = contentPayload(r, false), pool = await frozen(db, p), total = pool.groups.reduce((n, g) => n + g.weight, 0); return { probabilities: rarities.map((rarity, i) => ({ rarity: rarityNames[i], weight: p[weightNames[i]!], chance: weightNames.every(k => p[k] !== null) && total ? Number(p[weightNames[i]!]) / total * 100 : null, eligible: pool.groups.find(g => g.rarity === rarity)?.cards.length ?? 0 })) }; } });
registerReference('chocolatepools', async (db) => (await all(db, "SELECT * FROM content_records WHERE kind='chocolatepools' AND status='PUBLISHED'")).map(r => ({ id: String(r.id), name: String(contentPayload(r).title) })));
async function packetDTO(db: DB, v: Viewer, r: Row) { const batch = (await one(db, 'SELECT title,origin FROM packet_batches WHERE id=?', String(r.batch_id)))!, card = r.card_id ? await one(db, 'SELECT * FROM content_records WHERE id=?', String(r.card_id)) : null; const known = card && await contentAllowed(db, v, card) ? JSON.parse(String(r.card_snapshot_json)) : null; return { id: r.id, title: batch.title, origin: batch.origin, status: r.status, card: known ? { id: r.card_id, title: known.title, description: known.description, rarity: known.rarity, href: '/portal/conteudos/chocolatecards/' + r.card_id } : null }; }
async function copyDTO(db: DB, v: Viewer, r: Row, master = false) {
    const card = await contentRecord(db, 'chocolatecards', String(r.card_id));
    if (!master && !await contentAllowed(db, v, card))
        return null;
    const p = JSON.parse(String(r.snapshot_json));
    return { id: r.id, characterId: master ? r.character_id : undefined, version: r.version, cardId: r.card_id, title: p.title, rarity: p.rarity };
}
async function grant(db: DB, actor: Session, data: Record<string, unknown>) {
    fields(data, ['poolId', 'poolVersion', 'characters', 'quantity', 'origin', 'commandKey', 'confirm']);
    if (data.confirm !== true)
        fail(422, 'Confirme a origem e a posse dos pacotes.');
    const chars = stringIds(data.characters).sort(), quantity = data.quantity, origin = text(data.origin, 400), key = text(data.commandKey, 100), poolId = text(data.poolId, 100);
    if (!chars.length || typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 10 || quantity * chars.length > 50)
        fail(400, 'Use 1–10 pacotes por pessoa, até 50 por lote.');
    if (!/^[\w-]{12,100}$/.test(key))
        fail(400, 'Identificador inválido.');
    const request = JSON.stringify({ poolId, chars, quantity, origin });
    return await transaction(db, async () => {
        const old = await one(db, 'SELECT * FROM packet_grants WHERE command_key=?', key);
        if (old) {
            if (old.request_json !== request)
                fail(409, 'Identificador já usado com outros dados.');
            return { ok: true };
        }
        const pool = await contentRecord(db, 'chocolatepools', poolId);
        expected(pool, data.poolVersion);
        if (pool.status !== 'PUBLISHED')
            fail(422, 'Publique o pool antes de conceder pacotes.');
        const p = contentPayload(pool), prepared = await mapAsync(chars, async (char) => { await exists(db, 'characters', char); const v: Viewer = { role: 'PLAYER', userId: actor.userId, characterId: char, preview: false }, snapshot = await frozen(db, p, v); validPool(snapshot); return { char, snapshot }; });
        const id = randomUUID();
        await db.prepare('INSERT INTO packet_grants(id,command_key,request_json,actor_id) VALUES(?,?,?,?)').run(id, key, request, actor.userId);
        for (const { char, snapshot } of prepared) {
            const batch = randomUUID();
            await db.prepare('INSERT INTO packet_batches(id,grant_id,character_id,pool_id,pool_snapshot_json,title,origin) VALUES(?,?,?,?,?,?,?)').run(batch, id, char, poolId, JSON.stringify(snapshot), String(p.title), origin);
            for (let i = 0; i < quantity; i++)
                await db.prepare('INSERT INTO chocolate_packets(id,batch_id,character_id) VALUES(?,?,?)').run(randomUUID(), batch, char);
        }
        await audit(db, actor.userId, 'CHOCOLATE_PACKETS_GRANTED', 'PACKET_GRANT', id, { characters: chars, quantity, origin });
        return { ok: true };
    });
}
async function open(db: DB, actor: Session, v: Viewer, id: string, data: Record<string, unknown>) {
    fields(data, ['confirm']);
    if (data.confirm !== true)
        fail(422, 'Confirme a abertura.');
    if (actor.role !== 'PLAYER' || v.preview)
        fail(403, 'A prévia não abre pacotes.');
    return await transaction(db, async () => {
        const packet = await one(db, 'SELECT * FROM chocolate_packets WHERE id=? AND character_id=?', id, actor.characterId) ?? fail(404, 'Pacote não encontrado.');
        if (packet.status === 'OPENED')
            return await packetDTO(db, v, packet);
        if (packet.status !== 'SEALED')
            fail(409, 'Este pacote foi retirado pelo Mestre.');
        const batch = (await one(db, 'SELECT pool_snapshot_json FROM packet_batches WHERE id=?', String(packet.batch_id)))!, pool = JSON.parse(String(batch.pool_snapshot_json)) as FrozenPool;
        for (const group of pool.groups)
            for (const c of group.cards) {
                const current = await contentRecord(db, 'chocolatecards', c.id);
                if (!current.published_json || !await policyAllows(db, v, c.policy) || !await policyAllows(db, v, contentPolicy(current)))
                    fail(409, 'O pool deste pacote precisa ser revisado pelo Mestre.');
            }
        const chosen = drawCard(pool), row = await contentRecord(db, 'chocolatecards', chosen.id);
        await discoverCollection(db, actor, row, actor.characterId!, { snapshot: chosen.base, historical: true, presentation: 'ANIMATED' });
        await db.prepare("UPDATE chocolate_packets SET status='OPENED',card_id=?,card_snapshot_json=? WHERE id=?").run(chosen.id, JSON.stringify(chosen.base), id);
        await db.prepare('INSERT INTO chocolate_copies(id,character_id,card_id,snapshot_json,packet_id) VALUES(?,?,?,?,?)').run(randomUUID(), actor.characterId!, chosen.id, JSON.stringify(chosen.base), id);
        await audit(db, actor.userId, 'CHOCOLATE_PACKET_OPENED', 'PACKET', id);
        return await packetDTO(db, v, (await one(db, 'SELECT * FROM chocolate_packets WHERE id=?', id))!);
    });
}
async function trade(db: DB, actor: Session, data: Record<string, unknown>) {
    fields(data, ['copyA', 'copyB', 'versionA', 'versionB', 'ownerA', 'ownerB', 'commandKey', 'confirm']);
    if (data.confirm !== true)
        fail(422, 'Confirme a troca das cópias físicas.');
    const key = text(data.commandKey, 100), a = text(data.copyA, 100), b = text(data.copyB, 100), ownerA = text(data.ownerA, 100), ownerB = text(data.ownerB, 100);
    if (!/^[\w-]{12,100}$/.test(key))
        fail(400, 'Identificador inválido.');
    if (a === b || ownerA === ownerB)
        fail(422, 'Escolha cópias de dois proprietários diferentes.');
    const request = JSON.stringify({ a, b, ownerA, ownerB });
    return await transaction(db, async () => {
        const previous = await one(db, 'SELECT * FROM chocolate_trades WHERE command_key=?', key);
        if (previous) {
            if (previous.request_json !== request)
                fail(409, 'Identificador já usado em outra troca.');
            return { ok: true };
        }
        const ca = await one(db, 'SELECT * FROM chocolate_copies WHERE id=?', a) ?? fail(404, 'Cópia não encontrada.'), cb = await one(db, 'SELECT * FROM chocolate_copies WHERE id=?', b) ?? fail(404, 'Cópia não encontrada.');
        expected(ca, data.versionA);
        expected(cb, data.versionB);
        if (ca.character_id !== ownerA || cb.character_id !== ownerB)
            fail(409, 'A propriedade das cópias mudou.');
        for (const [copy, target] of [[ca, ownerB], [cb, ownerA]] as const) {
            const card = await contentRecord(db, 'chocolatecards', String(copy.card_id));
            await discoverCollection(db, actor, card, target, { snapshot: JSON.parse(String(copy.snapshot_json)), historical: true, presentation: 'SILENT' });
            await db.prepare('UPDATE chocolate_copies SET character_id=?,version=version+1 WHERE id=?').run(target, String(copy.id));
        }
        const id = randomUUID();
        await db.prepare('INSERT INTO chocolate_trades(id,command_key,request_json,snapshot_json,actor_id) VALUES(?,?,?,?,?)').run(id, key, request, JSON.stringify({ before: [ca, cb] }), actor.userId);
        await audit(db, actor.userId, 'CHOCOLATE_COPIES_TRADED', 'CARD_TRADE', id, { copyA: a, copyB: b, ownerA, ownerB });
        return { ok: true };
    });
}
export async function handleChocolate(req: IncomingMessage, res: ServerResponse, url: URL, db: DB, session?: Session): Promise<boolean> {
    const path = url.pathname, method = req.method ?? 'GET', admin = path.startsWith('/api/master/chocolate');
    if (!admin && !path.startsWith('/api/chocolate'))
        return false;
    const actor = requireSession(session), v = await viewerFor(db, actor, url);
    if (admin) {
        requireMaster(actor);
        if (url.searchParams.has('view_as'))
            fail(403, 'Saia da prévia para administrar.');
        if (path === '/api/master/chocolate' && method === 'GET') {
            send(res, 200, { characters: await all(db, 'SELECT id,name FROM characters'), pools: (await all(db, "SELECT id,version,published_json FROM content_records WHERE kind='chocolatepools' AND status='PUBLISHED'")).map(r => ({ id: r.id, version: r.version, title: JSON.parse(String(r.published_json)).title })), packets: await all(db, 'SELECT p.id,p.character_id,p.status,b.title,b.origin FROM chocolate_packets p JOIN packet_batches b ON b.id=p.batch_id ORDER BY p.rowid DESC'), copies: await mapAsync((await all(db, 'SELECT * FROM chocolate_copies')), async (r) => await copyDTO(db, v, r, true)) });
            return true;
        }
        if (path === '/api/master/chocolate/grant' && method === 'POST') {
            send(res, 200, await grant(db, actor, await jsonBody(req)));
            return true;
        }
        if (path === '/api/master/chocolate/cancel' && method === 'POST') {
            const d = await jsonBody(req);
            fields(d, ['packetId', 'reason', 'confirm']);
            if (d.confirm !== true)
                fail(422, 'Confirme a retirada.');
            await transaction(db, async () => {
                const p = await one(db, 'SELECT * FROM chocolate_packets WHERE id=?', text(d.packetId, 100)) ?? fail(404, 'Pacote não encontrado.');
                if (p.status === 'CANCELLED')
                    return;
                if (p.status !== 'SEALED')
                    fail(409, 'Um pacote já aberto não pode ser retirado.');
                const reason = text(d.reason, 2000);
                await db.prepare("UPDATE chocolate_packets SET status='CANCELLED',private_reason=? WHERE id=?").run(reason, String(p.id));
                await audit(db, actor.userId, 'CHOCOLATE_PACKET_CANCELLED', 'PACKET', String(p.id), { reason });
            });
            send(res, 200, { ok: true });
            return true;
        }
        if (path === '/api/master/chocolate/trade' && method === 'POST') {
            send(res, 200, await trade(db, actor, await jsonBody(req)));
            return true;
        }
    }
    else {
        if (!v.characterId)
            fail(403, 'Selecione um personagem.');
        if (path === '/api/chocolate' && method === 'GET') {
            send(res, 200, { packets: await mapAsync((await all(db, 'SELECT * FROM chocolate_packets WHERE character_id=? ORDER BY rowid DESC', v.characterId)), async (r) => await packetDTO(db, v, r)), copies: await flatMapAsync((await all(db, 'SELECT * FROM chocolate_copies WHERE character_id=?', v.characterId)), async (r) => { const dto = await copyDTO(db, v, r); return dto ? [dto] : []; }) });
            return true;
        }
        const match = path.match(/^\/api\/chocolate\/packets\/([\w-]+)\/open$/);
        if (match && method === 'POST') {
            send(res, 200, await open(db, actor, v, match[1]!, await jsonBody(req)));
            return true;
        }
    }
    fail(404, 'Recurso não encontrado.');
}
