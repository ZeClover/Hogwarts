import { filterAsync, mapAsync } from './async-array.ts';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { all, one, transaction, audit, type DB } from './db.ts';
import { fail, requireMaster, requireSession, type Session } from './auth.ts';
import { fields, jsonBody, text, send } from './http.ts';
import { expected, exists } from './editorial.ts';
import { academicYears, knownAcademicYear, calendarHeader } from './calendar-model.ts';
const competition = async (db: DB, year: string) => await one(db, 'SELECT * FROM house_competitions WHERE academic_year=?', year) ?? fail(404, 'Inicie a competição deste ano.');
async function totals(db: DB, year: string) { const houses = (await mapAsync((await all(db, 'SELECT * FROM houses')), async (h) => ({ id: h.id, name: h.name, crest: '/assets/' + h.crest, points: Number((await one(db, 'SELECT COALESCE(SUM(amount),0) n FROM house_point_entries WHERE academic_year=? AND house_id=?', year, String(h.id)))!.n) }))).sort((a, b) => b.points - a.points || String(a.name).localeCompare(String(b.name), 'pt-BR')); return houses.map(h => ({ ...h, rank: houses.filter(other => other.points > h.points).length + 1 })); }
export async function cupPublic(db: DB, year: string) {
    if (!await knownAcademicYear(db, year))
        fail(404, 'Ano não encontrado.');
    const c = await one(db, 'SELECT status FROM house_competitions WHERE academic_year=?', year), results = await all(db, 'SELECT academic_year,version,snapshot_json FROM house_results ORDER BY created_at DESC,rowid DESC');
    return { academicYear: year, years: await filterAsync(await academicYears(db), async (y) => y.id === (await calendarHeader(db)).academicYear || !!await one(db, 'SELECT academic_year FROM house_competitions WHERE academic_year=?', y.id)), competition: c ? { status: c.status, houses: await totals(db, year), result: results.find(r => r.academic_year === year) ? JSON.parse(String(results.find(r => r.academic_year === year)!.snapshot_json)) : null } : null, history: results.map(r => JSON.parse(String(r.snapshot_json))) };
}
async function administrative(db: DB, year: string) { return { ...await cupPublic(db, year), version: (await one(db, 'SELECT version FROM house_competitions WHERE academic_year=?', year))?.version ?? null, years: await academicYears(db), characters: await all(db, 'SELECT id,name FROM characters'), events: (await all(db, "SELECT id,draft_json FROM content_records WHERE kind='events'")).map(r => ({ id: r.id, name: JSON.parse(String(r.draft_json)).title })), entries: await all(db, 'SELECT * FROM house_point_entries WHERE academic_year=? ORDER BY rowid DESC', year) }; }
async function points(db: DB, actor: Session, year: string, data: Record<string, unknown>) {
    fields(data, ['academicYear', 'version', 'houseId', 'amount', 'reason', 'characterId', 'eventId', 'commandKey', 'confirm']);
    if (data.confirm !== true)
        fail(422, 'Confirme o lançamento.');
    if (typeof data.amount !== 'number' || !Number.isSafeInteger(data.amount) || !data.amount || Math.abs(data.amount) > 1e6)
        fail(400, 'Use pontos inteiros de −1 milhão a +1 milhão, diferentes de zero.');
    const house = text(data.houseId, 100), reason = text(data.reason ?? '', 2000, false), key = text(data.commandKey, 100);
    if (!/^[\w-]{12,100}$/.test(key))
        fail(400, 'Identificador inválido.');
    await exists(db, 'houses', house);
    const char = data.characterId === null ? null : text(data.characterId, 100), event = data.eventId === null ? null : text(data.eventId, 100);
    if (char)
        await exists(db, 'characters', char);
    if (event && !await one(db, "SELECT id FROM content_records WHERE id=? AND kind='events'", event))
        fail(400, 'Evento indisponível.');
    const command = year + ':' + house + ':' + key;
    return await transaction(db, async () => {
        const old = await one(db, 'SELECT * FROM house_point_entries WHERE command_key=?', command);
        if (old) {
            if (old.amount !== data.amount || old.reason !== reason || old.character_id !== char || old.event_id !== event)
                fail(409, 'Identificador já utilizado com outros dados.');
            return await administrative(db, year);
        }
        const c = await competition(db, year);
        expected(c, data.version);
        if (c.status !== 'OPEN')
            fail(409, 'Reabra a competição antes de corrigir os pontos.');
        const total = (await totals(db, year)).find(h => h.id === house)!.points + Number(data.amount);
        if (Math.abs(total) > 1e9)
            fail(422, 'O total ultrapassa o limite permitido.');
        const id = randomUUID();
        await db.prepare('INSERT INTO house_point_entries(id,academic_year,house_id,amount,reason,character_id,event_id,command_key,actor_id) VALUES(?,?,?,?,?,?,?,?,?)').run(id, year, house, Number(data.amount), reason, char, event, command, actor.userId);
        await db.prepare('UPDATE house_competitions SET version=version+1 WHERE academic_year=?').run(year);
        await audit(db, actor.userId, 'HOUSE_POINTS_POSTED', 'HOUSE_COMPETITION', year, { id, houseId: house, amount: data.amount, reason, characterId: char, eventId: event });
        return await administrative(db, year);
    });
}
export async function handleCup(req: IncomingMessage, res: ServerResponse, url: URL, db: DB, session?: Session): Promise<boolean> {
    const path = url.pathname, method = req.method ?? 'GET', admin = path.startsWith('/api/master/cup');
    if (!admin && path !== '/api/cup')
        return false;
    const actor = requireSession(session);
    if (!admin && method === 'GET') {
        send(res, 200, await cupPublic(db, url.searchParams.get('year') ?? (await calendarHeader(db)).academicYear));
        return true;
    }
    requireMaster(actor);
    if (url.searchParams.has('view_as'))
        fail(403, 'A prévia é somente leitura.');
    if (path === '/api/master/cup' && method === 'GET') {
        send(res, 200, await administrative(db, url.searchParams.get('year') ?? (await calendarHeader(db)).academicYear));
        return true;
    }
    if (method === 'POST') {
        const data = await jsonBody(req), year = text(data.academicYear, 100);
        if (!await knownAcademicYear(db, year))
            fail(400, 'Ano indisponível.');
        if (path === '/api/master/cup/points') {
            send(res, 200, await points(db, actor, year, data));
            return true;
        }
        const action = path.split('/').pop();
        if (!['start', 'close', 'reopen'].includes(action!))
            fail(404, 'Ação não encontrada.');
        fields(data, action === 'start' ? ['academicYear', 'confirm'] : action === 'close' ? ['academicYear', 'version', 'houseId', 'confirm'] : ['academicYear', 'version', 'reason', 'confirm']);
        if (data.confirm !== true)
            fail(422, 'Confirme a operação.');
        const result = await transaction(db, async () => {
            if (action === 'start') {
                if (!await one(db, 'SELECT academic_year FROM house_competitions WHERE academic_year=?', year)) {
                    await db.prepare('INSERT INTO house_competitions(academic_year) VALUES(?)').run(year);
                    await audit(db, actor.userId, 'HOUSE_COMPETITION_STARTED', 'HOUSE_COMPETITION', year);
                }
                return await administrative(db, year);
            }
            const c = await competition(db, year);
            if (action === 'close') {
                const house = text(data.houseId, 100);
                await exists(db, 'houses', house);
                if (c.status === 'CLOSED') {
                    const last = (await all(db, 'SELECT snapshot_json FROM house_results WHERE academic_year=? ORDER BY version DESC LIMIT 1', year))[0]!;
                    if (JSON.parse(String(last.snapshot_json)).winnerHouseId !== house)
                        fail(409, 'Reabra antes de escolher outro resultado.');
                    return await administrative(db, year);
                }
                expected(c, data.version);
                const snapshot = { revision: Number(c.version) + 1, academicYear: year, academicYearLabel: (await one(db, 'SELECT label FROM school_years WHERE id=?', year))!.label, winnerHouseId: house, houses: await totals(db, year) };
                await db.prepare('INSERT INTO house_results(id,academic_year,version,snapshot_json,actor_id) VALUES(?,?,?,?,?)').run(randomUUID(), year, Number(c.version) + 1, JSON.stringify(snapshot), actor.userId);
                await db.prepare("UPDATE house_competitions SET status='CLOSED',version=version+1 WHERE academic_year=?").run(year);
                await audit(db, actor.userId, 'HOUSE_RESULT_PUBLISHED', 'HOUSE_COMPETITION', year, { winnerHouseId: house });
            }
            else {
                expected(c, data.version);
                if (c.status !== 'CLOSED')
                    fail(409, 'A competição já está aberta.');
                const reason = text(data.reason, 2000);
                await db.prepare("UPDATE house_competitions SET status='OPEN',version=version+1 WHERE academic_year=?").run(year);
                await audit(db, actor.userId, 'HOUSE_COMPETITION_REOPENED', 'HOUSE_COMPETITION', year, { reason });
            }
            return await administrative(db, year);
        });
        send(res, 200, result);
        return true;
    }
    fail(404, 'Recurso não encontrado.');
}
