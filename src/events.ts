import { flatMapAsync } from './async-array.ts';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { all, one, type DB, type Row } from './db.ts';
import { fail, now, requireSession, viewerFor, sessionFrom, type Viewer, type Session } from './auth.ts';
import { send } from './http.ts';
import type { Config } from './config.ts';
export type EventContent = {
    kind?: string;
    title: string;
    text: string;
    href: string;
    image?: string | null;
    alt?: string;
};
type Resolver = (db: DB, viewer: Viewer, event: Row) => EventContent | null | Promise<EventContent | null>;
const resolvers = new Map<string, Resolver>();
export function registerEvent(type: string, resolver: Resolver) { resolvers.set(type, resolver); }
export async function enqueue(db: DB, characterId: string, type: string, resourceId: string, fragmentId: string | null, presentation = 'ANIMATED') {
    const id = randomUUID();
    await db.prepare('INSERT INTO delivery_events(id,character_id,type,resource_id,fragment_id,presentation) VALUES(?,?,?,?,?,?)').run(id, characterId, type, resourceId, fragmentId, presentation);
    return id;
}
// Call in the transaction that grants access. Updates do not repeat a first discovery.
export async function enqueueOnce(db: DB, characterId: string, type: string, resourceId: string, fragmentId: string | null = null, presentation = 'ANIMATED') {
    const existing = await one(db, 'SELECT id FROM delivery_events WHERE character_id=? AND type=? AND resource_id=? AND fragment_id IS ?', characterId, type, resourceId, fragmentId);
    return existing ? String(existing.id) : enqueue(db, characterId, type, resourceId, fragmentId, presentation);
}
export async function availableRecipients(db: DB, type: string, resourceId: string) {
    const result: string[]=[];
    for(const row of await all(db,'SELECT id FROM characters')) {
        const characterId=String(row.id), viewer: Viewer={userId:'',role:'PLAYER',characterId,preview:false};
        if(await resolvers.get(type)?.(db,viewer,{resource_id:resourceId,character_id:characterId})) result.push(characterId);
    }
    return result;
}
export async function notifyAvailable(db: DB, type: string, resourceId: string, characters?: string[], previouslyVisible: string[] = []) {
    for (const characterId of characters ?? await availableRecipients(db,type,resourceId)) {
        if(previouslyVisible.includes(characterId))continue;
        const viewer: Viewer = { userId: '', role: 'PLAYER', characterId, preview: false };
        if (await resolvers.get(type)?.(db, viewer, { resource_id: resourceId, character_id: characterId }))
            await enqueueOnce(db, characterId, type, resourceId);
    }
}
async function visible(db: DB, viewer: Viewer, event: Row) {
    if (event.character_id !== viewer.characterId)
        return null;
    const content = await resolvers.get(String(event.type))?.(db, viewer, event);
    return content ? { id: event.id, presentation: event.presentation, acknowledged: !!event.acknowledged_at, ...content } : null;
}
async function listing(db: DB, viewer: Viewer, history = false) {
    return (await flatMapAsync((await all(db, `SELECT * FROM delivery_events WHERE character_id=? ${history ? '' : 'AND acknowledged_at IS NULL'} ORDER BY created_at ${history ? 'DESC' : 'ASC'},rowid ${history ? 'DESC' : 'ASC'}`, viewer.characterId)), async (row) => { const dto = await visible(db, viewer, row); return dto ? [dto] : []; })).slice(0, history ? undefined : 100);
}
export async function handleEvents(req: IncomingMessage, res: ServerResponse, url: URL, db: DB, config: Config, session?: Session): Promise<boolean> {
    if (!url.pathname.startsWith('/api/events'))
        return false;
    const actor = requireSession(session), viewer = await viewerFor(db, actor, url), path = url.pathname, method = req.method ?? 'GET';
    if (!viewer.characterId)
        fail(403, 'Selecione seu personagem para consultar revelações.');
    if (path === '/api/events/stream' && method === 'GET') {
        if (actor.role !== 'PLAYER' || viewer.preview)
            fail(403, 'A prévia não abre apresentações.');
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.flushHeaders();
        let previous = '', running = false;
        const tick = async () => {
            if (running || res.destroyed || res.writableEnded) return;
            running = true;
            try {
                const current = await sessionFrom(db, req, config);
                if (res.destroyed || res.writableEnded) return;
                if (!current || current.role !== 'PLAYER' || current.characterId !== viewer.characterId) {
                    res.end();
                    return;
                }
                const ids = JSON.stringify((await listing(db, viewer)).map(e => e.id));
                if (res.destroyed || res.writableEnded) return;
                if (ids !== previous) {
                    previous = ids;
                    res.write(`data: ${ids}\n\n`);
                }
                else
                    res.write(': heartbeat\n\n');
            }
            catch {
                res.end();
            }
            finally { running = false; }
        };
        const timer = setInterval(tick, 1000);
        timer.unref();
        res.on('close', () => clearInterval(timer));
        await tick();
        return true;
    }
    if ((path === '/api/events' || path === '/api/events/history') && method === 'GET') {
        send(res, 200, { items: await listing(db, viewer, path.endsWith('/history')) });
        return true;
    }
    const match = path.match(/^\/api\/events\/([\w-]+)(?:\/(ack))?$/);
    if (match) {
        const event = await one(db, 'SELECT * FROM delivery_events WHERE id=? AND character_id=?', match[1]!, viewer.characterId) ?? fail(404, 'Revelação não encontrada.');
        if (!match[2] && method === 'GET') {
            const dto = await visible(db, viewer, event) ?? fail(404, 'Revelação não encontrada.');
            send(res, 200, dto);
            return true;
        }
        if (match[2] && method === 'POST') {
            if (viewer.preview)
                fail(403, 'A prévia é somente leitura.');
            await db.prepare('UPDATE delivery_events SET acknowledged_at=COALESCE(acknowledged_at,?) WHERE id=?').run(now(), String(event.id));
            send(res, 200, { ok: true });
            return true;
        }
    }
    fail(404, 'Recurso não encontrado.');
}

// Snapshot supported access-based discoveries around an authorization change.
// Explicit grants (pages, clues, collections, mail, possessions) have their own events.
export async function discoveryAccessSnapshot(db: DB) {
    const result = new Map<string, string[]>();
    const sources: [string, Row[]][] = [
        ['CONTENT_AVAILABLE', await all(db, "SELECT id FROM content_records WHERE kind IN('books','lessons','shops','notices')")],
        ['QUEST_AVAILABLE', await all(db, 'SELECT id FROM quests')],
        ['PUBLISHED_DOCUMENT', await all(db, "SELECT id FROM content_records WHERE kind IN('newspapers','yearbooks','retrospectives')")],
        ['WORLD_AVAILABLE', [...await all(db, 'SELECT id FROM locations'), ...await all(db, 'SELECT id FROM regions')]]
    ];
    for (const [type, rows] of sources)
        for (const row of rows) result.set(type + ':' + row.id, await availableRecipients(db, type, String(row.id)));
    return result;
}
export async function notifyDiscoveryAccess(db: DB, before: Map<string,string[]>) {
    const after = await discoveryAccessSnapshot(db);
    for (const [key, characters] of after) {
        const separator=key.indexOf(':'), type=key.slice(0,separator), id=key.slice(separator+1);
        await notifyAvailable(db,type,id,characters,before.get(key)??[]);
    }
}
