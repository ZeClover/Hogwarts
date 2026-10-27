import {giveItem} from './possessions.ts';
import { privateStorage } from './storage.ts';
import { filterAsync, forEachAsync, mapAsync } from './async-array.ts';
import { templateChoices, templateSnapshot, type TemplateSnapshot } from './templates-model.ts';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { all, one, transaction, audit, type DB, type Row } from './db.ts';
import { fail, requireMaster, requireSession, viewerFor, type Session, type Viewer } from './auth.ts';
import { fields, jsonBody, record, text, stringIds, send } from './http.ts';
import { exists, expected, policyAllows, type Policy } from './editorial.ts';
import type { Config } from './config.ts';
type Certificate = {
    fullName: string;
    title: string;
    participation: string;
    actions: string;
    result: string;
    closingText: string;
    signature: string;
    date: string;
    fileId: string | null;
    layout: string;
    templateId?: string | null;
    template?: TemplateSnapshot | null;
};
export type RewardPlan = {
    kind: string;
    referenceId: string | null;
    title: string;
    text: string;
    nuques: number;
    characters: string[];
};
type RewardHandler = {
    validate: (db: DB, plan: RewardPlan) => void | Promise<void>;
    apply: (db: DB, actor: Session, plan: RewardPlan, character: string, key: string) => Record<string, unknown> | Promise<Record<string, unknown>>;
};
const handlers = new Map<string, RewardHandler>();
export function registerReward(kind: string, handler: RewardHandler) { handlers.set(kind, handler); }
const certificate = async (db: DB, id: string) => await one(db, 'SELECT * FROM quest_certificates WHERE id=?', id) ?? fail(404, 'Certificado não encontrado.');
const planRow = async (db: DB, id: string) => await one(db, 'SELECT * FROM reward_plans WHERE id=?', id) ?? fail(404, 'Plano não encontrado.');
async function quest(db: DB, id: string) { return await one(db, 'SELECT * FROM quests WHERE id=?', id) ?? fail(404, 'Missão não encontrada.'); }
async function member(db: DB, questId: string, id: string) {
    await exists(db, 'characters', id);
    if (!await one(db, 'SELECT character_id FROM quest_participants WHERE quest_id=? AND character_id=?', questId, id))
        fail(422, 'Selecione um participante registrado nesta missão.');
}
async function validateCertificate(db: DB, value: unknown): Promise<Certificate> {
    const p = record(value);
    fields(p, ['fullName', 'title', 'participation', 'actions', 'result', 'closingText', 'signature', 'date', 'fileId', 'layout', 'templateId']);
    if (!['SUCCESS', 'PARTIAL_SUCCESS', 'FAILURE'].includes(String(p.result)))
        fail(400, 'Escolha o desfecho.');
    if (!['PARCHMENT', 'FORMAL'].includes(String(p.layout)))
        fail(400, 'Escolha o modelo.');
    const fileId = p.fileId === null ? null : text(p.fileId, 100);
    if (fileId)
        await exists(db, 'workshop_files', fileId);
    return { fullName: text(p.fullName, 160), title: text(p.title, 180), participation: text(p.participation, 2000, false), actions: text(p.actions, 3000, false), result: String(p.result), closingText: text(p.closingText, 2000, false), signature: text(p.signature, 200, false), date: text(p.date, 100, false), fileId, layout: String(p.layout), templateId: typeof p.templateId === 'string' ? p.templateId : null, template: await templateSnapshot(db, p.templateId, 'CERTIFICATE') };
}
const results: Record<string, string> = { SUCCESS: 'Sucesso', PARTIAL_SUCCESS: 'Sucesso parcial', FAILURE: 'Fracasso' };
async function pdf(db: DB, config: Config, p: Certificate) {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(await readFile('resources/fonts/DejaVuSerif.ttf'), { subset: true });
    const supported = new Set(font.getCharacterSet());
    for (const value of [...Object.values(p), ...Object.values(p.template ?? {})])
        if (typeof value === 'string')
            for (const char of value) {
                if (!supported.has(char.codePointAt(0)!) && !/\s/u.test(char))
                    fail(422, 'O certificado contém um caractere sem representação na fonte.');
            }
    let page = doc.addPage([595.28, 841.89]), y = 762;
    const tone = p.template?.tone, bronze = tone === 'BURGUNDY' ? rgb(.40, .1, .16) : tone === 'FOREST' ? rgb(.15, .32, .2) : tone === 'MIDNIGHT' ? rgb(.15, .2, .35) : rgb(.42, .29, .13), ink = rgb(.16, .12, .08);
    const decorate = () => { page.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89, color: (p.template ? p.template.variant !== 'FORMAL' : p.layout === 'PARCHMENT') ? rgb(.97, .94, .85) : rgb(1, 1, 1) }); page.drawRectangle({ x: 28, y: 28, width: 539.28, height: 785.89, borderWidth: 1, borderColor: bronze }); };
    decorate();
    const line = (value: string, size: number) => {
        let current = '';
        const flush = () => {
            if (y < 66) {
                page = doc.addPage([595.28, 841.89]);
                decorate();
                y = 762;
            }
            page.drawText(current, { x: 58, y, size, font, color: ink });
            y -= size * 1.55;
        };
        for (const paragraph of value.split('\n')) {
            for (const word of paragraph.split(/\s+/u)) {
                let remaining = word;
                while (font.widthOfTextAtSize(remaining, size) > 475) {
                    if (current) {
                        flush();
                        current = '';
                    }
                    let cut = 1;
                    while (cut < remaining.length && font.widthOfTextAtSize(remaining.slice(0, cut + 1), size) <= 475)
                        cut++;
                    current = remaining.slice(0, cut);
                    flush();
                    current = '';
                    remaining = remaining.slice(cut);
                }
                if (font.widthOfTextAtSize((current ? current + ' ' : '') + remaining, size) > 475) {
                    flush();
                    current = '';
                }
                current += (current ? ' ' : '') + remaining;
            }
            flush();
            current = '';
        }
        y -= 12;
    };
    if (p.fileId) {
        const f = (await one(db, 'SELECT storage_key FROM workshop_files WHERE id=?', p.fileId))!;
        const bytes = await sharp(await privateStorage(config).read(String(f.storage_key))).resize(180, 100, { fit: 'inside' }).png().toBuffer();
        const image = await doc.embedPng(bytes);
        page.drawImage(image, { x: (595.28 - image.width) / 2, y: 735 - image.height, width: image.width, height: image.height });
        y = 615;
    }
    line(p.template?.heading || 'HOGWARTS · ARQUIVOS MÁGICOS', 12);
    line(p.title, 22);
    line(p.fullName, 18);
    line(results[p.result]!, 12);
    line(p.participation, 12);
    line(p.actions, 12);
    line(p.closingText, 12);
    line([p.date, p.signature].filter(Boolean).join('\n'), 11);
    if (p.template?.footer)
        line(p.template.footer, 10);
    doc.setTitle(p.title);
    doc.setAuthor(p.signature || 'Hogwarts');
    return Buffer.from(await doc.save());
}
async function publicIssue(db: DB, row: Row) { const c = await certificate(db, String(row.certificate_id)), p = JSON.parse(String(row.snapshot_json)) as Certificate; return { id: row.id, questId: c.quest_id, title: p.title, fullName: p.fullName, result: p.result, pdf: '/api/documents/certificates/' + row.id + '/pdf' }; }
async function canIssue(db: DB, viewer: Viewer, row: Row) { const c = await certificate(db, String(row.certificate_id)); return !!row.released && (c.character_id === viewer.characterId || (JSON.parse(String(row.shares_json)) as string[]).includes(viewer.characterId ?? '')); }
async function adminCertificate(db: DB, row: Row) { return { id: row.id, questId: row.quest_id, characterId: row.character_id, version: row.version, payload: JSON.parse(String(row.draft_json)), history: (await all(db, 'SELECT version,snapshot_json,created_at FROM certificate_revisions WHERE certificate_id=? ORDER BY version DESC LIMIT 20', String(row.id))).map(r => ({ version: r.version, payload: JSON.parse(String(r.snapshot_json)), createdAt: r.created_at })), issues: await mapAsync((await all(db, 'SELECT id,certificate_id,certificate_version,snapshot_json,released,created_at FROM certificate_issues WHERE certificate_id=? ORDER BY certificate_version DESC', String(row.id))), async (r) => ({ ...await publicIssue(db, r), version: r.certificate_version, released: !!r.released, pdf: '/api/master/documents/issues/' + r.id + '/pdf' })) }; }
async function saveCertificate(db: DB, actor: Session, questId: string, data: Record<string, unknown>, id?: string) {
    fields(data, id ? ['version', 'payload'] : ['characterId', 'payload']);
    await quest(db, questId);
    const p = await validateCertificate(db, data.payload);
    return await transaction(db, async () => {
        let row: Row;
        if (id) {
            const old = await certificate(db, id);
            if (old.quest_id !== questId)
                fail(404, 'Certificado não encontrado.');
            expected(old, data.version);
            await db.prepare('UPDATE quest_certificates SET draft_json=?,version=version+1 WHERE id=?').run(JSON.stringify(p), id);
            row = await certificate(db, id);
        }
        else {
            const char = text(data.characterId, 100);
            await member(db, questId, char);
            id = randomUUID();
            await db.prepare('INSERT INTO quest_certificates(id,quest_id,character_id,draft_json,actor_id) VALUES(?,?,?,?,?)').run(id, questId, char, JSON.stringify(p), actor.userId);
            row = await certificate(db, id);
        }
        await db.prepare('INSERT INTO certificate_revisions(certificate_id,version,snapshot_json,actor_id) VALUES(?,?,?,?)').run(id!, Number(row.version), JSON.stringify(p), actor.userId);
        await audit(db, actor.userId, 'CERTIFICATE_SAVED', 'CERTIFICATE', id!);
        return await adminCertificate(db, row);
    });
}
registerReward('NARRATIVE', { validate: () => { }, apply: (_db, _actor, p) => ({ kind: 'NARRATIVE', title: p.title, text: p.text }) });
registerReward('ITEM', { validate: async (db, p) => {
        const item = await one(db, "SELECT published_json FROM catalog_items WHERE id=? AND status='PUBLISHED'", p.referenceId);
        if (!item)
            fail(422, 'Publique o item antes de conceder.');
    }, apply: async (db, actor, p, character, commandKey) => {
        const item = (await one(db, 'SELECT * FROM catalog_items WHERE id=?', p.referenceId))!;
        if (!await policyAllows(db, { role: 'PLAYER', userId: '', characterId: character, preview: false }, JSON.parse(String(item.published_policy_json)) as Policy))
            fail(422, 'Um destinatário não pode consultar o item.');
        const known = JSON.parse(String(item.published_json)) as {
            name: string;
            description: string;
            effectsText?: string;
        };
        const description=[known.description,known.effectsText].filter(Boolean).join('\n\n');
        await giveItem(db,actor.userId,character,p.referenceId!,1,'reward:'+commandKey,{title:known.name,description});
        return { kind: 'ITEM', title: known.name, text: description, itemId: p.referenceId };
    } });
async function validatePlan(db: DB, value: unknown): Promise<RewardPlan> {
    const p = record(value);
    fields(p, ['kind', 'referenceId', 'title', 'text', 'nuques', 'characters']);
    const kind = text(p.kind, 40);
    if (!['ITEM', 'NARRATIVE', 'MONEY', 'COLLECTION', 'MEMORY'].includes(kind))
        fail(400, 'Tipo de recompensa inválido.');
    const chars = stringIds(p.characters);
    if (!chars.length)
        fail(422, 'Selecione beneficiários.');
    await forEachAsync(chars, async (id) => await exists(db, 'characters', id));
    if (typeof p.nuques !== 'number' || !Number.isSafeInteger(p.nuques) || p.nuques < 0 || p.nuques > 1e12)
        fail(400, 'Valor inválido.');
    return { kind, referenceId: p.referenceId === null ? null : text(p.referenceId, 100), title: text(p.title, 180), text: text(p.text, 3000, false), nuques: p.nuques, characters: chars };
}
async function adminPlan(db: DB, row: Row) { return { id: row.id, questId: row.quest_id, version: row.version, payload: JSON.parse(String(row.plan_json)), granted: !!row.granted, grants: (await all(db, 'SELECT id,character_id,receipt_json FROM reward_grants WHERE plan_id=?', String(row.id))).map(r => ({ id: r.id, characterId: r.character_id, receipt: JSON.parse(String(r.receipt_json)) })) }; }
async function savePlan(db: DB, actor: Session, questId: string, data: Record<string, unknown>, id?: string) {
    fields(data, id ? ['version', 'payload'] : ['payload']);
    await quest(db, questId);
    const p = await validatePlan(db, data.payload);
    await forEachAsync(p.characters, async (c) => await member(db, questId, c));
    return await transaction(db, async () => {
        if (id) {
            const old = await planRow(db, id);
            if (old.quest_id !== questId)
                fail(404, 'Plano não encontrado.');
            expected(old, data.version);
            if (old.granted)
                fail(409, 'Concessões confirmadas não podem ser editadas. Crie outro plano.');
            await db.prepare('UPDATE reward_plans SET plan_json=?,version=version+1 WHERE id=?').run(JSON.stringify(p), id);
        }
        else {
            id = randomUUID();
            await db.prepare('INSERT INTO reward_plans(id,quest_id,plan_json,actor_id) VALUES(?,?,?,?)').run(id, questId, JSON.stringify(p), actor.userId);
        }
        await audit(db, actor.userId, 'REWARD_PLANNED', 'REWARD', id!, { plan: p });
        return await adminPlan(db, await planRow(db, id!));
    });
}
async function grant(db: DB, actor: Session, id: string, data: Record<string, unknown>) {
    fields(data, ['version', 'characters', 'confirm']);
    if (data.confirm !== true)
        fail(422, 'Confirme a concessão explicitamente.');
    return await transaction(db, async () => {
        const row = await planRow(db, id), p = JSON.parse(String(row.plan_json)) as RewardPlan;
        const chosen = stringIds(data.characters).sort();
        if (JSON.stringify(chosen) !== JSON.stringify([...p.characters].sort()))
            fail(422, 'Confirme todos os beneficiários do plano revisado.');
        if (row.granted)
            return await adminPlan(db, row);
        expected(row, data.version);
        const handler = handlers.get(p.kind) ?? fail(422, 'Esta concessão depende de uma oficina ainda não disponível.');
        await handler.validate(db, p);
        for (const char of p.characters) {
            const id = randomUUID(), receipt = await handler.apply(db, actor, p, char, String(row.id) + ':' + char);
            await db.prepare('INSERT INTO reward_grants(id,plan_id,character_id,receipt_json,actor_id) VALUES(?,?,?,?,?)').run(id, String(row.id), char, JSON.stringify(receipt), actor.userId);
        }
        await db.prepare('UPDATE reward_plans SET granted=1,version=version+1 WHERE id=?').run(id);
        await audit(db, actor.userId, 'REWARD_GRANTED', 'REWARD', id, { characters: p.characters });
        return await adminPlan(db, await planRow(db, id));
    });
}
function sendPDF(res: ServerResponse, bytes: Buffer) { res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="certificado.pdf"', 'Content-Length': bytes.length }); res.end(bytes); }
export async function handleDocuments(req: IncomingMessage, res: ServerResponse, url: URL, db: DB, config: Config, session?: Session): Promise<boolean> {
    const path = url.pathname, method = req.method ?? 'GET', admin = path.startsWith('/api/master/documents');
    if (!admin && !path.startsWith('/api/documents'))
        return false;
    const actor = requireSession(session);
    if (admin) {
        requireMaster(actor);
        if (url.searchParams.has('view_as'))
            fail(403, 'Saia da prévia para administrar.');
        if (path === '/api/master/documents/context' && method === 'GET') {
            send(res, 200, { templates: await templateChoices(db, 'CERTIFICATE'), rewardKinds: [...handlers.keys()], collections: (await all(db, "SELECT id,kind,status,draft_json FROM content_records WHERE kind IN('chocolatecards','bestiary','rarities','memories','curiosities')")).map(r => ({ id: r.id, kind: r.kind, status: r.status, name: JSON.parse(String(r.draft_json)).title })), items: (await all(db, 'SELECT id,draft_json,status FROM catalog_items')).map(r => ({ id: r.id, name: JSON.parse(String(r.draft_json)).name, status: r.status })) });
            return true;
        }
        const match = path.match(/^\/api\/master\/documents\/quests\/([\w-]+)\/(certificates|rewards)(?:\/([\w-]+)(?:\/(preview|issue|grant))?)?$/);
        if (match) {
            const qid = match[1]!, kind = match[2]!, id = match[3], action = match[4];
            await quest(db, qid);
            if (!id && method === 'GET') {
                send(res, 200, { items: await mapAsync((await all(db, kind === 'certificates' ? 'SELECT * FROM quest_certificates WHERE quest_id=?' : 'SELECT * FROM reward_plans WHERE quest_id=?', qid)), async (row) => kind === 'certificates' ? await adminCertificate(db, row) : await adminPlan(db, row)) });
                return true;
            }
            if (!action && ['POST', 'PATCH'].includes(method)) {
                const body = await jsonBody(req, 65536);
                send(res, id ? 200 : 201, kind === 'certificates' ? await saveCertificate(db, actor, qid, body, id) : await savePlan(db, actor, qid, body, id));
                return true;
            }
            if (id && kind === 'rewards' && action === 'grant' && method === 'POST') {
                const row = await planRow(db, id);
                if (row.quest_id !== qid)
                    fail(404, 'Plano não encontrado.');
                send(res, 200, await grant(db, actor, id, await jsonBody(req)));
                return true;
            }
            if (id && kind === 'certificates') {
                const row = await certificate(db, id);
                if (row.quest_id !== qid)
                    fail(404, 'Certificado não encontrado.');
                if (!action && method === 'GET') {
                    send(res, 200, await adminCertificate(db, row));
                    return true;
                }
                if (action === 'preview' && method === 'GET') {
                    sendPDF(res, await pdf(db, config, JSON.parse(String(row.draft_json))));
                    return true;
                }
                if (action === 'issue' && method === 'POST') {
                    const body = await jsonBody(req);
                    fields(body, ['version']);
                    expected(row, body.version);
                    const existing = await one(db, 'SELECT id FROM certificate_issues WHERE certificate_id=? AND certificate_version=?', id, Number(row.version));
                    if (!existing) {
                        const bytes = await pdf(db, config, JSON.parse(String(row.draft_json)));
                        await transaction(db, async () => { expected(await certificate(db, id), body.version); await db.prepare('INSERT INTO certificate_issues(id,certificate_id,certificate_version,snapshot_json,pdf_base64,actor_id) VALUES(?,?,?,?,?,?) ON CONFLICT(certificate_id,certificate_version) DO NOTHING').run(randomUUID(), id, Number(row.version), String(row.draft_json), bytes.toString('base64'), actor.userId); await audit(db, actor.userId, 'CERTIFICATE_ISSUED', 'CERTIFICATE', id); });
                    }
                    send(res, 200, await adminCertificate(db, await certificate(db, id)));
                    return true;
                }
            }
        }
        const issue = path.match(/^\/api\/master\/documents\/issues\/([\w-]+)\/(pdf|release|withdraw)$/);
        if (issue) {
            const row = await one(db, 'SELECT * FROM certificate_issues WHERE id=?', issue[1]!) ?? fail(404, 'Documento não encontrado.');
            if (issue[2] === 'pdf' && method === 'GET') {
                sendPDF(res, Buffer.from(String(row.pdf_base64), 'base64'));
                return true;
            }
            if (method === 'POST' && ['release', 'withdraw'].includes(issue[2]!)) {
                const body = await jsonBody(req);
                fields(body, ['confirm']);
                if (body.confirm !== true)
                    fail(422, 'Confirme a liberação.');
                await transaction(db, async () => { await db.prepare('UPDATE certificate_issues SET released=? WHERE id=?').run(Number(issue[2] === 'release'), String(row.id)); await audit(db, actor.userId, issue[2] === 'release' ? 'CERTIFICATE_RELEASED' : 'CERTIFICATE_WITHDRAWN', 'CERTIFICATE_ISSUE', String(row.id)); });
                send(res, 200, { ok: true });
                return true;
            }
        }
    }
    else {
        const viewer = await viewerFor(db, actor, url);
        if (!viewer.characterId)
            fail(403, 'Selecione um personagem.');
        if (path === '/api/documents/context' && method === 'GET') {
            send(res, 200, { characters: await all(db, 'SELECT id,name FROM characters') });
            return true;
        }
        if (path === '/api/documents/certificates' && method === 'GET') {
            send(res, 200, { items: await mapAsync(await filterAsync((await all(db, 'SELECT * FROM certificate_issues WHERE released=1')), async (r) => await canIssue(db, viewer, r)), async (r) => ({ ...await publicIssue(db, r), isOwner: (await certificate(db, String(r.certificate_id))).character_id === viewer.characterId, shares: (await certificate(db, String(r.certificate_id))).character_id === viewer.characterId ? JSON.parse(String(r.shares_json)) : [] })) });
            return true;
        }
        if(path==='/api/documents/inventory'&&method==='GET') {
            send(res,200,{items:(await all(db,'SELECT id,item_id,quantity,snapshot_json FROM item_possessions WHERE character_id=? ORDER BY created_at,id',viewer.characterId)).map(r=>({id:r.id,itemId:r.item_id,quantity:r.quantity,...JSON.parse(String(r.snapshot_json))}))});return true;
        }
        if(path==='/api/documents/seals'&&method==='GET') {
            const items=[];
            for(const row of await all(db,'SELECT o.*,q.published_json,q.published_policy_json FROM quest_outcomes o JOIN quests q ON q.id=o.quest_id JOIN quest_participants p ON p.quest_id=q.id AND p.character_id=? AND p.active=1 ORDER BY o.created_at DESC,o.id',viewer.characterId)) {
                const legacy=await one(db,'SELECT s.protagonist_id FROM legacy_story_missions m JOIN personal_story_arcs s ON s.id=m.story_id WHERE m.quest_id=?',String(row.quest_id));
                if((legacy&&legacy.protagonist_id!==viewer.characterId)||!JSON.parse(String(row.characters_json)).includes(viewer.characterId)||!row.published_json||!await policyAllows(db,viewer,JSON.parse(String(row.published_policy_json))))continue;
                const outcome=JSON.parse(String(row.public_json));items.push({id:row.id,questId:row.quest_id,title:JSON.parse(String(row.published_json)).title,...outcome});
            }
            send(res,200,{items});return true;
        }
        if (path === '/api/documents/rewards' && method === 'GET') {
            send(res, 200, { items: (await all(db, 'SELECT id,receipt_json FROM reward_grants WHERE character_id=?', viewer.characterId)).map(r => ({ id: r.id, ...JSON.parse(String(r.receipt_json)) })) });
            return true;
        }
        const issue = path.match(/^\/api\/documents\/certificates\/([\w-]+)\/(pdf|share)$/);
        if (issue) {
            const row = await one(db, 'SELECT * FROM certificate_issues WHERE id=?', issue[1]!) ?? fail(404, 'Documento não encontrado.');
            if (!await canIssue(db, viewer, row))
                fail(404, 'Documento não encontrado.');
            if (issue[2] === 'pdf' && method === 'GET') {
                sendPDF(res, Buffer.from(String(row.pdf_base64), 'base64'));
                return true;
            }
            if (issue[2] === 'share' && method === 'POST') {
                const c = await certificate(db, String(row.certificate_id));
                if (viewer.preview || c.character_id !== actor.characterId)
                    fail(403, 'Somente o titular pode autorizar compartilhamento.');
                const body = await jsonBody(req);
                fields(body, ['characters', 'confirm']);
                if (body.confirm !== true)
                    fail(422, 'Confirme os destinatários.');
                const chars = stringIds(body.characters);
                await forEachAsync(chars, async (id) => await exists(db, 'characters', id));
                await transaction(db, async () => { await db.prepare('UPDATE certificate_issues SET shares_json=? WHERE id=?').run(JSON.stringify(chars), String(row.id)); await audit(db, actor.userId, 'CERTIFICATE_SHARED', 'CERTIFICATE_ISSUE', String(row.id), { characters: chars }); });
                send(res, 200, { ok: true });
                return true;
            }
        }
    }
    fail(404, 'Recurso não encontrado.');
}
