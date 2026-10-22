import { flatMapAsync } from './async-array.ts';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { all, one, type DB, type Row } from './db.ts';
import { fail, now, requireSession, viewerFor, sessionFrom, type Viewer, type Session } from './auth.ts';
import { send } from './http.ts';
import type { Config } from './config.ts';
export type EventContent = {
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
async function visible(db: DB, viewer: Viewer, event: Row) {
    if (event.character_id !== viewer.characterId)
        return null;
    const content = await resolvers.get(String(event.type))?.(db, viewer, event);
    return content ? { id: event.id, presentation: event.presentation, acknowledged: !!event.acknowledged_at, ...content } : null;
}
async function listing(db: DB, viewer: Viewer, history = false) {
    return (await flatMapAsync((await all(db, `SELECT * FROM delivery_events WHERE character_id=? ${history ? '' : 'AND acknowledged_at IS NULL'} ORDER BY created_at ${history ? 'DESC' : 'ASC'},id`, viewer.characterId)), async (row) => { const dto = await visible(db, viewer, row); return dto ? [dto] : []; })).slice(0, history ? 30 : 100);
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
