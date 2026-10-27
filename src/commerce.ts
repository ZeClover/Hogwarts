import {giveItem} from './possessions.ts';
import { mapAsync } from './async-array.ts';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { all, one, transaction, audit, type DB, type Row } from './db.ts';
import { fail, requireMaster, requireSession, viewerFor, type Session, type Viewer } from './auth.ts';
import { jsonBody, fields, text, send } from './http.ts';
import { exists, expected } from './editorial.ts';
import { contentRecord, contentPayload, contentAllowed } from './content.ts';
import { publicItem } from './world.ts';
import { registerReward } from './documents.ts';
import { renderImage } from './workshop.ts';
import type { Config } from './config.ts';
export async function balance(db: DB, char: string) { return Number((await one(db, 'SELECT COALESCE(SUM(amount),0) total FROM wallet_entries WHERE character_id=?', char))!.total); }
const amount = (v: unknown, signed = false) => typeof v === 'number' && Number.isSafeInteger(v) && v >= (signed ? -1e12 : 0) && v <= 1e12 ? v : fail(400, 'Use um valor inteiro em Nuques dentro do limite permitido.');
const key = (v: unknown) => {
    const value = text(v, 100);
    if (!/^[\w-]{12,100}$/.test(value))
        fail(400, 'Identificador da operação inválido.');
    return value;
};
export async function postWallet(db: DB, actor: Session, char: string, delta: number, kind: 'ADJUSTMENT' | 'PURCHASE' | 'REWARD', title: string, reason: string, commandKey: string) {
    await exists(db, 'characters', char);
    amount(delta, true);
    if (!delta)
        fail(422, 'O lançamento precisa alterar o saldo.');
    const previous = await one(db, 'SELECT * FROM wallet_entries WHERE command_key=?', commandKey);
    if (previous) {
        if (previous.character_id !== char || previous.amount !== delta || previous.kind !== kind || previous.title !== title || previous.private_reason !== reason)
            fail(409, 'A operação já foi usada com outros dados.');
        return previous.id;
    }
    const next = await balance(db, char) + delta;
    if (next < 0)
        fail(409, 'Saldo insuficiente.');
    if (!Number.isSafeInteger(next) || next > 1e12)
        fail(422, 'O saldo excede o limite permitido.');
    const id = randomUUID();
    await db.prepare('INSERT INTO wallet_entries(id,character_id,amount,kind,title,private_reason,command_key,actor_id) VALUES(?,?,?,?,?,?,?,?)').run(id, char, delta, kind, title, reason, commandKey, actor.userId);
    await audit(db, actor.userId, 'WALLET_POSTED', 'WALLET', char, { id, amount: delta, kind, reason, balance: next });
    return id;
}
registerReward('MONEY', { validate: (_db, p) => {
        if (p.nuques <= 0)
            fail(422, 'Informe uma recompensa monetária positiva.');
    }, apply: async (db, actor, p, char, commandKey) => { await postWallet(db, actor, char, p.nuques, 'REWARD', p.title, 'Recompensa confirmada pelo Mestre', 'reward:' + commandKey); return { kind: 'MONEY', title: p.title, text: p.text, nuques: p.nuques }; } });
const order = async (db: DB, id: string) => await one(db, 'SELECT * FROM purchase_orders WHERE id=?', id) ?? fail(404, 'Pedido não encontrado.');
function publicOrder(row: Row) { const receipt = row.receipt_json ? JSON.parse(String(row.receipt_json)) : null; return { id: row.id, status: row.status, version: row.version, quantity: row.quantity, negotiation: row.negotiation ?? '', requested: JSON.parse(String(row.requested_json)), receipt: receipt ? { ...receipt, image: row.image_file_id ? '/api/commerce/orders/' + row.id + '/image' : null } : null }; }
async function adminOrder(db: DB, row: Row) { const offer = await contentRecord(db, 'offers', String(row.offer_id)), p = contentPayload(offer, !!offer.published_json), stock = await one(db, 'SELECT remaining FROM offer_stock WHERE offer_id=?', String(offer.id)); return { ...publicOrder(row), characterId: row.character_id, offerId: row.offer_id, privateReason: row.private_reason, referencePriceNuques: p.priceNuques, stock: stock?.remaining ?? null, balance: await balance(db, String(row.character_id)) }; }
async function requestOrder(db: DB, actor: Session, viewer: Viewer, data: Record<string, unknown>) {
    fields(data, ['offerId', 'quantity', 'requestKey']);
    if (actor.role !== 'PLAYER' || viewer.preview || !actor.characterId)
        fail(403, 'A prévia não solicita compras.');
    const id = text(data.offerId, 100), requestKey = key(data.requestKey), quantity = amount(data.quantity);
    if (quantity < 1 || quantity > 99)
        fail(400, 'Escolha entre 1 e 99 unidades.');
    return await transaction(db, async () => {
        const existing = await one(db, 'SELECT * FROM purchase_orders WHERE character_id=? AND request_key=?', actor.characterId, requestKey);
        if (existing) {
            if (existing.offer_id !== id || existing.quantity !== quantity)
                fail(409, 'Identificador já usado em outro pedido.');
            return publicOrder(existing);
        }
        const offer = await contentRecord(db, 'offers', id);
        if (!await contentAllowed(db, viewer, offer))
            fail(404, 'Oferta não encontrada.');
        const p = contentPayload(offer), stock = await one(db, 'SELECT remaining FROM offer_stock WHERE offer_id=?', id);
        if (stock?.remaining !== null && stock?.remaining !== undefined && Number(stock.remaining) < quantity)
            fail(409, 'Quantidade indisponível.');
        const item = (await publicItem(db, viewer, String(p.itemId)))!, orderId = randomUUID();
        await db.prepare('INSERT INTO purchase_orders(id,character_id,offer_id,request_key,quantity,requested_json) VALUES(?,?,?,?,?,?)').run(orderId, actor.characterId, id, requestKey, quantity, JSON.stringify({ title: item.title, description: item.description }));
        await audit(db, actor.userId, 'PURCHASE_REQUESTED', 'ORDER', orderId, { quantity });
        return publicOrder(await order(db, orderId));
    });
}
async function approve(db: DB, actor: Session, id: string, data: Record<string, unknown>) {
    fields(data, ['version', 'paidNuques', 'confirm']);
    if (data.confirm !== true)
        fail(422, 'Confirme a aprovação.');
    const paid = amount(data.paidNuques);
    return await transaction(db, async () => {
        const row = await order(db, id);
        if (row.status === 'APPROVED') {
            const receipt = JSON.parse(String(row.receipt_json));
            if (receipt.paidNuques !== paid)
                fail(409, 'O pedido já foi aprovado com outro valor.');
            return await adminOrder(db, row);
        }
        expected(row, data.version);
        if (row.status !== 'PENDING')
            fail(409, 'O pedido não está aguardando aprovação.');
        const viewer: Viewer = { userId: actor.userId, role: 'PLAYER', characterId: String(row.character_id), preview: false }, offer = await contentRecord(db, 'offers', String(row.offer_id));
        if (!await contentAllowed(db, viewer, offer))
            fail(409, 'A oferta deixou de estar disponível para este destinatário.');
        const p = contentPayload(offer), stock = await one(db, 'SELECT remaining FROM offer_stock WHERE offer_id=?', String(offer.id));
        if (stock?.remaining !== null && stock?.remaining !== undefined && Number(stock.remaining) < Number(row.quantity))
            fail(409, 'Estoque insuficiente.');
        const it = (await publicItem(db, viewer, String(p.itemId)))!, item = (await one(db, 'SELECT published_json FROM catalog_items WHERE id=?', String(p.itemId)))!, raw = JSON.parse(String(item.published_json));
        if (paid)
            await postWallet(db, actor, String(row.character_id), -paid, 'PURCHASE', it.title, 'Compra aprovada pelo Mestre', 'order:' + id);
        if (stock?.remaining !== null && stock?.remaining !== undefined)
            await db.prepare('UPDATE offer_stock SET remaining=remaining-? WHERE offer_id=?').run(Number(row.quantity), String(offer.id));
        await giveItem(db,actor.userId,String(row.character_id),String(p.itemId),Number(row.quantity),'order:'+id,{title:it.title,description:it.description});
        const receipt = { title: it.title, description: it.description, quantity: row.quantity, paidNuques: paid };
        await db.prepare("UPDATE purchase_orders SET status='APPROVED',version=version+1,receipt_json=?,image_file_id=?,image_crop_json=?,actor_id=? WHERE id=?").run(JSON.stringify(receipt), raw.fileId, JSON.stringify(raw.crop), actor.userId, id);
        await audit(db, actor.userId, 'PURCHASE_APPROVED', 'ORDER', id, { paidNuques: paid, quantity: row.quantity });
        return await adminOrder(db, await order(db, id));
    });
}
async function closeOrder(db: DB, actor: Session, id: string, data: Record<string, unknown>, cancel = false) {
    fields(data, cancel ? ['version'] : ['version', 'reason']);
    return await transaction(db, async () => {
        const row = await order(db, id);
        if (cancel && row.character_id !== actor.characterId)
            fail(404, 'Pedido não encontrado.');
        if (row.status === (cancel ? 'CANCELLED' : 'REJECTED'))
            return publicOrder(row);
        expected(row, data.version);
        if (row.status !== 'PENDING')
            fail(409, 'O pedido já foi resolvido.');
        const reason = cancel ? '' : text(data.reason, 2000);
        await db.prepare('UPDATE purchase_orders SET status=?,version=version+1,private_reason=?,actor_id=? WHERE id=?').run(cancel ? 'CANCELLED' : 'REJECTED', reason, actor.userId, id);
        await audit(db, actor.userId, cancel ? 'PURCHASE_CANCELLED' : 'PURCHASE_REJECTED', 'ORDER', id, { reason });
        return publicOrder(await order(db, id));
    });
}
export async function handleCommerce(req: IncomingMessage, res: ServerResponse, url: URL, db: DB, config: Config, session?: Session): Promise<boolean> {
    const path = url.pathname, method = req.method ?? 'GET', admin = path.startsWith('/api/master/commerce');
    if (!admin && !path.startsWith('/api/commerce'))
        return false;
    const actor = requireSession(session), viewer = await viewerFor(db, actor, url);
    if (admin) {
        requireMaster(actor);
        if (url.searchParams.has('view_as'))
            fail(403, 'Saia da prévia para administrar.');
        if (path === '/api/master/commerce' && method === 'GET') {
            send(res, 200, { characters: await mapAsync((await all(db, 'SELECT id,name FROM characters')), async (c) => ({ ...c, balance: await balance(db, String(c.id)) })), orders: await mapAsync((await all(db, 'SELECT * FROM purchase_orders ORDER BY created_at DESC,id')), async (r) => await adminOrder(db, r)), entries: await all(db, 'SELECT * FROM wallet_entries ORDER BY created_at DESC,id LIMIT 100') });
            return true;
        }
        if (path === '/api/master/commerce/adjust' && method === 'POST') {
            const data = await jsonBody(req);
            fields(data, ['characterId', 'amount', 'title', 'reason', 'commandKey', 'confirm']);
            if (data.confirm !== true)
                fail(422, 'Confirme o lançamento.');
            const char = text(data.characterId, 100), delta = amount(data.amount, true), title = text(data.title ?? 'Ajuste da carteira', 180), reason = text(data.reason ?? '', 2000, false), commandKey = 'manual:' + char + ':' + key(data.commandKey);
            const id = await transaction(db, async () => await postWallet(db, actor, char, delta, 'ADJUSTMENT', title, reason, commandKey));
            send(res, 200, { id, balance: await balance(db, char) });
            return true;
        }
        const match = path.match(/^\/api\/master\/commerce\/orders\/([\w-]+)\/(approve|reject|negotiate)$/);
        if (match && method === 'POST') {
            if(match[2]==='negotiate') {
                const data=await jsonBody(req);fields(data,['version','message']);const message=text(data.message,2000);
                await transaction(db,async()=>{const row=await order(db,match[1]!);expected(row,data.version);if(row.status!=='PENDING')fail(409,'O pedido já foi resolvido.');await db.prepare('UPDATE purchase_orders SET negotiation=?,version=version+1 WHERE id=?').run(message,match[1]!);await audit(db,actor.userId,'PURCHASE_NEGOTIATED','ORDER',match[1]!);});
                send(res,200,await adminOrder(db,await order(db,match[1]!)));return true;
            }

            send(res, 200, match[2] === 'approve' ? await approve(db, actor, match[1]!, await jsonBody(req)) : await closeOrder(db, actor, match[1]!, await jsonBody(req)));
            return true;
        }
    }
    else {
        if (!viewer.characterId)
            fail(403, 'Selecione um personagem.');
        if (path === '/api/commerce/wallet' && method === 'GET') {
            send(res, 200, { balance: await balance(db, viewer.characterId), entries: await all(db, 'SELECT id,amount,kind,title FROM wallet_entries WHERE character_id=? ORDER BY created_at DESC,id', viewer.characterId) });
            return true;
        }
        if (path === '/api/commerce/orders') {
            if (method === 'GET') {
                send(res, 200, { items: (await all(db, 'SELECT * FROM purchase_orders WHERE character_id=? ORDER BY created_at DESC,id', viewer.characterId)).map(publicOrder) });
                return true;
            }
            if (method === 'POST') {
                send(res, 201, await requestOrder(db, actor, viewer, await jsonBody(req)));
                return true;
            }
        }
        const match = path.match(/^\/api\/commerce\/orders\/([\w-]+)(?:\/(cancel|image))?$/);
        if (match) {
            const row = await order(db, match[1]!);
            if (row.character_id !== viewer.characterId)
                fail(404, 'Pedido não encontrado.');
            if (match[2] === 'cancel' && method === 'POST') {
                if (viewer.preview)
                    fail(403, 'A prévia é somente leitura.');
                send(res, 200, await closeOrder(db, actor, String(row.id), await jsonBody(req), true));
                return true;
            }
            if (method === 'GET') {
                if (match[2] === 'image') {
                    if (row.status !== 'APPROVED' || !row.image_file_id)
                        fail(404, 'Imagem indisponível.');
                    await renderImage(db, config, res, { fileId: String(row.image_file_id), crop: JSON.parse(String(row.image_crop_json)) }, false);
                    return true;
                }
                send(res, 200, publicOrder(row));
                return true;
            }
        }
    }
    fail(404, 'Recurso não encontrado.');
}
