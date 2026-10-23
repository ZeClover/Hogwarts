import { filterAsync, mapAsync } from './async-array.ts';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { all, one, transaction, audit, type DB } from './db.ts';
import { fail, requireMaster, requireSession, viewerFor } from './auth.ts';
import { fields, jsonBody, text, send } from './http.ts';
import { expected } from './editorial.ts';
import { registerContent, registerReference, contentPayload, contentAllowed, contentProject, type Field } from './content.ts';
import { academicYears, knownAcademicYear, calendarHeader } from './calendar-model.ts';
import { npcReference } from './npcs.ts';
import { locationVisible } from './access.ts';
import type { Session } from './auth.ts';
registerReference('years', async (db) => (await academicYears(db)).map(y => ({ id: y.id, name: y.name + (y.archived ? ' · Arquivo' : '') })));
registerContent('years', { label: 'Anos letivos', singular: 'Ano letivo', global: true, fields: [{ name: 'title', label: 'Nome do ano letivo', required: true, max: 120 }, { name: 'startYear', label: 'Ano inicial', type: 'number', min: 1, max: 9998, required: true, draftOptional: true }], project: (_db, _v, _row, p) => ({ title: p.title, description: `${p.startYear}–${Number(p.startYear) + 1}` }), published: async (db, row, before) => {
        const p = contentPayload(row), id = `${p.startYear}–${Number(p.startYear) + 1}`;
        if (before.published_json && contentPayload(before).startYear !== p.startYear)
            fail(409, 'O ano inicial é fixo após publicação. Crie outro ano.');
        const existing = await one(db, 'SELECT record_id FROM school_years WHERE id=?', id);
        if (existing && existing.record_id !== row.id)
            fail(409, 'Este ano já está cadastrado.');
        await db.prepare('INSERT INTO school_years(id,record_id,label,start_year) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label,archived=0').run(id, String(row.id), String(p.title), Number(p.startYear));
    }, archived: async (db, row) => {
        const id = (await one(db, 'SELECT id FROM school_years WHERE record_id=?', String(row.id)))?.id;
        if (!id)
            return;
        if ((await calendarHeader(db)).academicYear === id)
            fail(409, 'Publique outro ano atual antes de arquivar este ano.');
        await db.prepare('UPDATE school_years SET archived=1 WHERE record_id=?').run(String(row.id));
    } });
const year: Field = { name: 'academicYear', label: 'Ano letivo', type: 'reference', source: 'years', required: true };
registerContent('events', { label: 'Eventos do calendário', singular: 'Evento', fields: [{ name: 'title', label: 'Nome do evento', required: true, max: 180 }, { name: 'description', label: 'Descrição pública', type: 'richtext', max: 8000 }, year, { name: 'narrativeDate', label: 'Data narrativa', max: 120 }, { name: 'time', label: 'Horário narrativo', max: 100 }, { name: 'locationId', label: 'Local', type: 'reference', source: 'places' }, { name: 'npcId', label: 'NPC relacionado', type: 'reference', source: 'npcs' }, { name: 'isTemplate', label: 'Modelo de evento (não aparece no calendário)', type: 'checkbox', advanced: true }, { name: 'recurrence', label: 'Recorrência informativa do modelo', max: 180, advanced: true }], allowed: (_db, _v, _row, p) => !p.isTemplate, project: async (db, v, _r, p) => ({ title: p.title, description: p.description, meta: [p.academicYear, p.narrativeDate, p.time].filter(Boolean), npc: p.npcId ? await npcReference(db, v, String(p.npcId)) : null }) });
registerContent('timetables', { label: 'Grades de horários', singular: 'Grade', fields: [{ name: 'title', label: 'Nome da grade', required: true, max: 180 }, year, { name: 'slots', label: 'Horários', type: 'blocks', max: 70, fields: [{ name: 'id', label: 'Identificador do horário', type: 'id' }, { name: 'day', label: 'Dia', type: 'select', options: ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'], required: true }, { name: 'time', label: 'Horário', required: true, draftOptional: true, max: 80 }, { name: 'subject', label: 'Matéria', required: true, draftOptional: true, max: 180 }, { name: 'npcId', label: 'Professor', type: 'reference', source: 'npcs' }, { name: 'locationId', label: 'Sala', type: 'reference', source: 'places' }, { name: 'lessonId', label: 'Aula relacionada', type: 'reference', source: 'lessons' }] }], duplicate: p => ({ ...p, slots: (p.slots as Record<string, unknown>[]).map(s => ({ ...s, id: randomUUID() })) }), project: async (db, v, _r, p) => ({ title: p.title, meta: [p.academicYear], table: { columns: ['Dia', 'Horário', 'Matéria', 'Professor', 'Sala'], rows: await mapAsync((p.slots as Record<string, unknown>[]), async (s) => { const loc = s.locationId ? await one(db, 'SELECT * FROM locations WHERE id=?', String(s.locationId)) : null; return [s.day, s.time, s.subject, s.npcId ? (await npcReference(db, v, String(s.npcId)))?.name ?? '' : '', loc && await locationVisible(db, v, loc) ? loc.title : '']; }) } }) });
export async function handleCalendar(req: IncomingMessage, res: ServerResponse, url: URL, db: DB, session?: Session): Promise<boolean> {
    const path = url.pathname, method = req.method ?? 'GET';
    if (path !== '/api/calendar' && path !== '/api/calendar/years' && !path.startsWith('/api/master/calendar'))
        return false;
    const actor = requireSession(session);
    if (path === '/api/calendar/years' && method === 'GET') {
        send(res, 200, { items: await academicYears(db) });
        return true;
    }
    if (path === '/api/calendar' && method === 'GET') {
        const v = await viewerFor(db, actor, url), list = async (kind: string) => await mapAsync((await filterAsync((await all(db, 'SELECT * FROM content_records WHERE kind=?', kind)), async (r) => await contentAllowed(db, v, r))), async (r) => await contentProject(db, v, r));
        send(res, 200, { state: await calendarHeader(db), events: await list('events'), timetables: await list('timetables') });
        return true;
    }
    requireMaster(actor);
    if (url.searchParams.has('view_as'))
        fail(403, 'A prévia é somente leitura.');
    const row = (await one(db, 'SELECT * FROM calendar_state WHERE id=1'))!;
    if (path === '/api/master/calendar' && method === 'GET') {
        send(res, 200, { version: row.version, draft: JSON.parse(String(row.draft_json)), published: await calendarHeader(db), years: await academicYears(db) });
        return true;
    }
    if (path === '/api/master/calendar' && method === 'PATCH') {
        const data = await jsonBody(req);
        fields(data, ['version', 'academicYear', 'narrativeDate']);
        send(res, 200, await transaction(db, async () => {
            const before = (await one(db, 'SELECT * FROM calendar_state WHERE id=1'))!;
            expected(before, data.version);
            if (!await knownAcademicYear(db, data.academicYear) || (await one(db, 'SELECT archived FROM school_years WHERE id=?', String(data.academicYear)))!.archived)
                fail(422, 'Escolha um ano publicado e ativo.');
            const p = { academicYear: data.academicYear, narrativeDate: text(data.narrativeDate, 180, false) };
            await db.prepare('UPDATE calendar_state SET draft_json=?,version=version+1 WHERE id=1').run(JSON.stringify(p));
            await audit(db, actor.userId, 'CALENDAR_SAVED', 'CALENDAR', '1', { before: JSON.parse(String(before.draft_json)), after: p });
            return { ok: true };
        }));
        return true;
    }
    if (path === '/api/master/calendar/publish' && method === 'POST') {
        const data = await jsonBody(req);
        fields(data, ['version', 'confirm']);
        if (data.confirm !== true)
            fail(422, 'Confirme a publicação da data.');
        send(res, 200, await transaction(db, async () => {
            const before = (await one(db, 'SELECT * FROM calendar_state WHERE id=1'))!;
            expected(before, data.version);
            const p = JSON.parse(String(before.draft_json));
            if (!await knownAcademicYear(db, p.academicYear) || (await one(db, 'SELECT archived FROM school_years WHERE id=?', p.academicYear))!.archived)
                fail(422, 'O ano escolhido foi arquivado.');
            await db.prepare('UPDATE calendar_state SET published_json=draft_json,version=version+1 WHERE id=1').run();
            await audit(db, actor.userId, 'CALENDAR_PUBLISHED', 'CALENDAR', '1', { before: JSON.parse(String(before.published_json)), after: p });
            return { state: await calendarHeader(db) };
        }));
        return true;
    }
    fail(404, 'Recurso não encontrado.');
}
