import { filterAsync, flatMapAsync, forEachAsync, mapAsync } from './async-array.ts';
import { contentAllowed } from './content.ts';
import { knownAcademicYear } from './calendar-model.ts';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Config } from './config.ts';
import { all, one, audit, transaction, type DB, type Row } from './db.ts';
import { fail, now, digest, requireMaster, requireSession, viewerFor, type Session, type Viewer } from './auth.ts';
import { fields, jsonBody, record, send, text, stringIds } from './http.ts';
import { exists, expected, validatePolicy, policyAllows, imageStamp, type Policy } from './editorial.ts';
import { locationVisible } from './access.ts';
import { npcReference } from './npcs.ts';
import { renderImage } from './workshop.ts';
import { enqueue, registerEvent } from './events.ts';
type Domain = 'quests' | 'stories';
type Payload = {
    title: string;
    summary: string;
    kind: string;
    academicYear: string;
    fileId: string | null;
    alt: string;
    npcId: string | null;
    locationId: string | null;
    hook: string;
};
type Internal = {
    synopsis: string;
    importance: string;
    releaseConditions: string;
    notes: string;
};
type Entry = {
    id: string;
    kind: string;
    title: string;
    text: string;
    npcId: string | null;
    locationId: string | null;
    fileId: string | null;
    alt: string;
};
type Objective = {
    id: string;
    title: string;
    description: string;
    optional: boolean;
    internalOnly: boolean;
    policy: Policy;
};
type Clue = Entry & {
    policy: Policy;
    collectionId?: string | null;
};
type Published = Payload & {
    entries?: Entry[];
    objectives?: Objective[];
    clues?: Clue[];
};
const definitions = async (db: DB, id: string, kind: 'objectives' | 'clues') => await all(db, `SELECT * FROM quest_${kind} WHERE quest_id=? ORDER BY position,id`, id);
const preparedDefinitions = async (db: DB, id: string, kind: 'objectives' | 'clues') => (await definitions(db, id, kind)).map(r => ({ id: String(r.id), ...JSON.parse(String(r.draft_json)) }));
async function operationSnapshot(db: DB, row: Row) {
    return { operationState: row.operation_state, objectives: await definitions(db, String(row.id), 'objectives'), clues: await definitions(db, String(row.id), 'clues'),
        progress: await all(db, 'SELECT * FROM quest_objective_progress WHERE quest_id=?', String(row.id)), clueReveals: await all(db, 'SELECT * FROM quest_clue_reveals WHERE quest_id=?', String(row.id)), outcomes: await all(db, 'SELECT * FROM quest_outcomes WHERE quest_id=? ORDER BY version,id', String(row.id)) };
}
const table = (domain: Domain) => domain === 'quests' ? 'quests' : 'personal_story_arcs';
const revisionTable = (domain: Domain) => domain === 'quests' ? 'quest_revisions' : 'story_revisions';
const get = async (db: DB, domain: Domain, id: string) => await one(db, `SELECT * FROM ${table(domain)} WHERE id=?`, id) ?? fail(404, 'Registro não encontrado.');
const payload = (row: Row, published = false): Published => JSON.parse(String(published ? row.published_json : row.draft_json));
const policy = (row: Row, published = false): Policy => JSON.parse(String(published ? row.published_policy_json : row.draft_policy_json));
const privateData = (row: Row): Internal => JSON.parse(String(row.private_json));
const entryRows = async (db: DB, id: string) => await all(db, 'SELECT * FROM personal_story_entries WHERE arc_id=? ORDER BY position,id', id);
const entries = async (db: DB, id: string): Promise<Entry[]> => (await entryRows(db, id)).map(r => ({ id: String(r.id), ...JSON.parse(String(r.draft_json)) }));
const participants = async (db: DB, id: string) => await all(db, 'SELECT character_id,active,state,released_revision,released_at,started_at FROM quest_participants WHERE quest_id=? ORDER BY character_id', id);
const reveals = async (db: DB, id: string) => await all(db, 'SELECT * FROM personal_story_reveals WHERE arc_id=? ORDER BY position,entry_id', id);
async function optional(db: DB, value: unknown, entity: 'locations' | 'workshop_files' | 'npcs') {
    if (value === null)
        return null;
    const id = text(value, 100);
    if (entity === 'npcs') {
        if (!await one(db, 'SELECT id FROM npcs WHERE id=?', id))
            fail(400, 'NPC indisponível.');
    }
    else
        await exists(db, entity, id);
    return id;
}
async function validatePayload(db: DB, value: unknown): Promise<Payload> {
    const p = record(value);
    fields(p, ['title', 'summary', 'kind', 'academicYear', 'fileId', 'alt', 'npcId', 'locationId', 'hook']);
    if (!await knownAcademicYear(db, p.academicYear))
        fail(400, 'Selecione o ano letivo disponível.');
    return { title: text(p.title, 120), summary: text(p.summary, 3000, false), kind: text(p.kind, 80, false), academicYear: String(p.academicYear),
        fileId: await optional(db, p.fileId, 'workshop_files'), alt: text(p.alt, 300, false), npcId: await optional(db, p.npcId, 'npcs'), locationId: await optional(db, p.locationId, 'locations'), hook: text(p.hook, 2000, false) };
}
function validatePrivate(value: unknown): Internal {
    const p = record(value);
    fields(p, ['synopsis', 'importance', 'releaseConditions', 'notes']);
    return { synopsis: text(p.synopsis, 4000, false), importance: text(p.importance, 200, false), releaseConditions: text(p.releaseConditions, 2000, false), notes: text(p.notes, 2000, false) };
}
function ready(p: {
    fileId: string | null;
    alt: string;
}) {
    if (p.fileId && !p.alt)
        fail(422, 'Preencha o texto alternativo de cada imagem antes de preparar ou publicar.');
}
async function composed(db: DB, domain: Domain, row: Row): Promise<Published> { return { ...payload(row), ...(domain === 'stories' ? { entries: await entries(db, String(row.id)) } : { objectives: await preparedDefinitions(db, String(row.id), 'objectives'), clues: await preparedDefinitions(db, String(row.id), 'clues') }) }; }
async function pending(db: DB, domain: Domain, row: Row) { return !!row.published_json && (JSON.stringify(await composed(db, domain, row)) !== JSON.stringify({ ...payload(row, true), ...(domain === 'quests' ? { objectives: payload(row, true).objectives ?? [], clues: payload(row, true).clues ?? [] } : {}) }) || row.draft_policy_json !== row.published_policy_json); }
async function snapshot(db: DB, domain: Domain, row: Row) {
    return { status: row.status, version: row.version, payload: payload(row), policy: policy(row), private: privateData(row),
        published: row.published_json ? payload(row, true) : null, publishedPolicy: row.published_policy_json ? policy(row, true) : null, publishedRevision: row.published_revision,
        ...(domain === 'quests' ? { participants: await participants(db, String(row.id)), ...await operationSnapshot(db, row) } : { protagonistId: row.protagonist_id, accessActive: !!row.access_active, releasedAt: row.released_at,
            entries: (await entryRows(db, String(row.id))).map(r => ({ id: r.id, position: r.position, payload: JSON.parse(String(r.draft_json)), privateNotes: r.private_notes })),
            reveals: (await reveals(db, String(row.id))).map(r => ({ ...r, snapshot: JSON.parse(String(r.snapshot_json)), snapshot_json: undefined })) }) };
}
async function revision(db: DB, domain: Domain, row: Row, actor: Session, action: string) {
    await db.prepare(`INSERT INTO ${revisionTable(domain)}(record_id,version,actor_id,action,snapshot_json) VALUES(?,?,?,?,?)`).run(String(row.id), Number(row.version), actor.userId, action, JSON.stringify(await snapshot(db, domain, row)));
    await audit(db, actor.userId, `${domain === 'quests' ? 'QUEST' : 'STORY'}_${action}`, domain === 'quests' ? 'QUEST' : 'STORY', String(row.id), { version: row.version });
}
async function adminDTO(db: DB, domain: Domain, row: Row) {
    const p = payload(row), file = p.fileId ? await one(db, 'SELECT id,origin_asset FROM workshop_files WHERE id=?', p.fileId) : null;
    return { id: row.id, status: row.status, version: row.version, payload: p, policy: policy(row), private: privateData(row), publishedRevision: row.published_revision,
        hasUnpublishedChanges: await pending(db, domain, row), sourceImage: file ? { image: `/api/master/workshop/files/${file.id}`, originalAlreadyPublic: !!file.origin_asset } : null,
        ...(domain === 'quests' ? { participants: await participants(db, String(row.id)), ...await operationSnapshot(db, row) } : { protagonistId: row.protagonist_id, protagonistLocked: row.released_at !== null, accessActive: !!row.access_active,
            entries: (await entryRows(db, String(row.id))).map(r => ({ id: r.id, payload: JSON.parse(String(r.draft_json)), privateNotes: r.private_notes })),
            publishedEntryIds: row.published_json ? (payload(row, true).entries ?? []).map(e => e.id) : [],
            reveals: (await reveals(db, String(row.id))).map(r => ({ entryId: r.entry_id, title: JSON.parse(String(r.snapshot_json)).title, active: !!r.active, sourceRevision: r.source_revision })) }) };
}
async function eligible(db: DB, viewer: Viewer, domain: Domain, row: Row, draft = false) {
    return !!viewer.characterId && (domain === 'quests' || row.protagonist_id === viewer.characterId) && await policyAllows(db, viewer, policy(row, !draft));
}
async function canAnnounce(db: DB, viewer: Viewer, row: Row) { return row.status === 'PUBLISHED' && row.operation_state !== 'CLOSED' && !!row.published_json && await eligible(db, viewer, 'quests', row); }
async function canRead(db: DB, viewer: Viewer, domain: Domain, row: Row) {
    if (!row.published_json || !await eligible(db, viewer, domain, row))
        return false;
    return domain === 'stories' ? !!row.access_active : !!await one(db, 'SELECT 1 FROM quest_participants WHERE quest_id=? AND character_id=? AND active=1', String(row.id), viewer.characterId!);
}
async function links(db: DB, viewer: Viewer, p: {
    npcId: string | null;
    locationId: string | null;
}) {
    const location = p.locationId ? await one(db, 'SELECT * FROM locations WHERE id=?', p.locationId) : null;
    return { npc: p.npcId ? await npcReference(db, viewer, p.npcId) : null, location: location && await locationVisible(db, viewer, location) ? { id: location.id, title: location.title } : null };
}
function entryStamp(r: Row) { return digest(`${r.arc_id}:${r.entry_id}:${r.snapshot_json}`).slice(0, 20); }
async function project(db: DB, viewer: Viewer, domain: Domain, row: Row, { draft = false, announcement = false, imageURL }: {
    draft?: boolean;
    announcement?: boolean;
    imageURL?: string;
} = {}) {
    const p = payload(row, !draft), enrollment = domain === 'quests' && viewer.characterId ? await one(db, 'SELECT state FROM quest_participants WHERE quest_id=? AND character_id=? AND active=1', String(row.id), viewer.characterId) : null;
    const known = domain === 'stories' && await canRead(db, viewer, domain, row) ? await mapAsync((await reveals(db, String(row.id))).filter(r => !!r.active && r.character_id === viewer.characterId), async (r) => {
        const e: Entry = JSON.parse(String(r.snapshot_json));
        return { id: e.id, kind: e.kind, title: e.title, text: e.text, ...await links(db, viewer, e), alt: e.fileId ? e.alt : '',
            image: e.fileId ? `/api/campaign/stories/${row.id}/entries/${r.entry_id}/image?stamp=${entryStamp(r)}${viewer.preview ? '&view_as=' + encodeURIComponent(viewer.characterId!) : ''}` : null };
    }) : [];
    return { id: row.id, title: p.title, summary: p.summary, kind: p.kind, academicYear: String(p.academicYear), hook: p.hook, ...await links(db, viewer, p),
        image: p.fileId ? (imageURL ?? `/api/campaign/${announcement ? 'announcements' : domain}/${row.id}/image?stamp=${imageStamp(row)}&context=${announcement ? 'announcement' : 'diary'}`) : null, alt: p.fileId ? p.alt : '',
        ...(announcement ? {} : { archived: row.status !== 'PUBLISHED', ...(domain === 'quests' ? { state: row.operation_state === 'CLOSED' ? 'CLOSED' : enrollment?.state ?? null, ...await publicOperations(db, viewer, row) } : { entries: known }) }) };
}
async function create(db: DB, domain: Domain, actor: Session, data: Record<string, unknown>) {
    fields(data, domain === 'quests' ? ['payload', 'policy', 'private'] : ['payload', 'policy', 'private', 'protagonistId']);
    const p = await validatePayload(db, data.payload), rules = await validatePolicy(db, data.policy), internal = validatePrivate(data.private), id = randomUUID();
    const protagonist = domain === 'stories' ? text(data.protagonistId, 100) : null;
    if (protagonist)
        await exists(db, 'characters', protagonist);
    return await transaction(db, async () => {
        const columns = domain === 'stories' ? ',protagonist_id' : '', placeholder = domain === 'stories' ? ',?' : '';
        await db.prepare(`INSERT INTO ${table(domain)}(id,owner_user_id,draft_json,draft_policy_json,private_json${columns}) VALUES(?,?,?,?,?${placeholder})`)
            .run(id, actor.userId, JSON.stringify(p), JSON.stringify(rules), JSON.stringify(internal), ...(protagonist ? [protagonist] : []));
        const row = await get(db, domain, id);
        await revision(db, domain, row, actor, 'CREATED');
        return await adminDTO(db, domain, row);
    });
}
async function save(db: DB, domain: Domain, actor: Session, id: string, data: Record<string, unknown>) {
    fields(data, domain === 'quests' ? ['version', 'payload', 'policy', 'private'] : ['version', 'payload', 'policy', 'private', 'protagonistId']);
    return await transaction(db, async () => {
        const before = await get(db, domain, id);
        expected(before, data.version);
        if (before.status === 'ARCHIVED')
            fail(409, 'Restaure o registro antes de editar.');
        const p = await validatePayload(db, data.payload), rules = await validatePolicy(db, data.policy), internal = validatePrivate(data.private);
        if (domain === 'stories') {
            const protagonist = text(data.protagonistId, 100);
            await exists(db, 'characters', protagonist);
            if (before.released_at !== null && before.protagonist_id !== protagonist)
                fail(409, 'O protagonista fica fixo após a primeira liberação. Duplique como novo arco para outro personagem.');
            await db.prepare('UPDATE personal_story_arcs SET protagonist_id=? WHERE id=?').run(protagonist, id);
        }
        await db.prepare(`UPDATE ${table(domain)} SET draft_json=?,draft_policy_json=?,private_json=?,version=version+1,status=CASE WHEN status='PREPARED' THEN 'DRAFT' ELSE status END,updated_at=? WHERE id=?`)
            .run(JSON.stringify(p), JSON.stringify(rules), JSON.stringify(internal), now(), id);
        const row = await get(db, domain, id);
        await revision(db, domain, row, actor, 'SAVED');
        return await adminDTO(db, domain, row);
    });
}
async function bump(db: DB, domain: Domain, id: string) { await db.prepare(`UPDATE ${table(domain)} SET version=version+1,updated_at=? WHERE id=?`).run(now(), id); }
async function command(db: DB, domain: Domain, actor: Session, id: string, action: string, data: Record<string, unknown>) {
    fields(data, ['version']);
    return await transaction(db, async () => {
        const before = await get(db, domain, id);
        expected(before, data.version);
        if (action === 'archive') {
            if (before.status === 'ARCHIVED')
                fail(409, 'O registro já está arquivado.');
            await db.prepare(`UPDATE ${table(domain)} SET status='ARCHIVED' WHERE id=?`).run(id);
        }
        else if (action === 'restore') {
            if (before.status !== 'ARCHIVED')
                fail(409, 'Somente um registro arquivado pode ser restaurado.');
            await db.prepare(`UPDATE ${table(domain)} SET status='DRAFT' WHERE id=?`).run(id);
        }
        else if (action === 'prepare' || action === 'publish') {
            if (before.status === 'ARCHIVED')
                fail(409, 'Restaure o registro antes de publicar.');
            const p = await composed(db, domain, before);
            ready(p);
            (p.entries ?? []).forEach(ready);
            (p.clues ?? []).forEach(ready);
            if (action === 'prepare') {
                if (before.status === 'PUBLISHED')
                    fail(409, 'O registro já possui uma revisão publicada.');
                await db.prepare(`UPDATE ${table(domain)} SET status='PREPARED' WHERE id=?`).run(id);
            }
            else
                await db.prepare(`UPDATE ${table(domain)} SET status='PUBLISHED',published_json=?,published_policy_json=draft_policy_json,published_revision=version+1,published_at=? WHERE id=?`).run(JSON.stringify(p), now(), id);
        }
        else
            fail(404, 'Ação não encontrada.');
        await bump(db, domain, id);
        const row = await get(db, domain, id);
        await revision(db, domain, row, actor, action.toUpperCase());
        return await adminDTO(db, domain, row);
    });
}
async function duplicate(db: DB, domain: Domain, actor: Session, id: string, data: Record<string, unknown>) {
    fields(data, ['version']);
    return await transaction(db, async () => {
        const before = await get(db, domain, id);
        expected(before, data.version);
        const copyId = randomUUID(), p = payload(before);
        p.title = `${p.title.slice(0, 110)} — cópia`;
        await db.prepare(`INSERT INTO ${table(domain)}(id,owner_user_id,draft_json,draft_policy_json,private_json${domain === 'stories' ? ',protagonist_id' : ''}) VALUES(?,?,?,?,?${domain === 'stories' ? ',?' : ''})`)
            .run(copyId, actor.userId, JSON.stringify(p), String(before.draft_policy_json), String(before.private_json), ...(domain === 'stories' ? [String(before.protagonist_id)] : []));
        if (domain === 'quests')
            for (const kind of ['objectives', 'clues'] as const)
                for (const e of await definitions(db, id, kind))
                    await db.prepare(`INSERT INTO quest_${kind}(id,quest_id,position,draft_json,private_notes) VALUES(?,?,?,?,?)`).run(randomUUID(), copyId, Number(e.position), String(e.draft_json), String(e.private_notes));
        if (domain === 'stories')
            for (const e of await entryRows(db, id))
                await db.prepare('INSERT INTO personal_story_entries(id,arc_id,position,draft_json,private_notes) VALUES(?,?,?,?,?)').run(randomUUID(), copyId, Number(e.position), String(e.draft_json), String(e.private_notes));
        const row = await get(db, domain, copyId);
        await revision(db, domain, row, actor, 'DUPLICATED');
        return await adminDTO(db, domain, row);
    });
}
async function questAccess(db: DB, actor: Session, id: string, action: string, data: Record<string, unknown>) {
    fields(data, ['version', 'characters']);
    const characters = stringIds(data.characters);
    if (!characters.length)
        fail(400, 'Selecione participantes.');
    await forEachAsync(characters, async (c) => await exists(db, 'characters', c));
    return await transaction(db, async () => {
        const before = await get(db, 'quests', id);
        expected(before, data.version);
        if (action !== 'revoke' && before.operation_state === 'CLOSED')
            fail(409, 'Reabra a missão antes de liberar ou iniciar participantes.');
        if (action !== 'revoke' && before.status !== 'PUBLISHED')
            fail(409, 'Publique a missão antes desta ação.');
        for (const characterId of characters) {
            const viewer: Viewer = { userId: actor.userId, role: 'PLAYER', characterId, preview: true };
            if (action === 'release' && !await eligible(db, viewer, 'quests', before))
                fail(422, 'Um participante não atende ao público publicado. Nenhuma alteração foi aplicada.');
            if (action === 'start') {
                const member = await one(db, 'SELECT * FROM quest_participants WHERE quest_id=? AND character_id=?', id, characterId);
                if (!await canRead(db, viewer, 'quests', before) || member?.state !== 'AVAILABLE')
                    fail(409, 'Todos os selecionados devem ter a missão liberada e ainda não iniciada.');
            }
        }
        for (const characterId of characters) {
            if (action === 'release')
                await db.prepare(`INSERT INTO quest_participants(quest_id,character_id,released_revision,actor_id) VALUES(?,?,?,?)
        ON CONFLICT(quest_id,character_id) DO UPDATE SET state=CASE WHEN active=0 THEN 'AVAILABLE' ELSE state END,started_at=CASE WHEN active=0 THEN NULL ELSE started_at END,active=1,released_revision=excluded.released_revision,actor_id=excluded.actor_id,released_at=unixepoch()`)
                    .run(id, characterId, Number(before.published_revision), actor.userId);
            else if (action === 'start')
                await db.prepare("UPDATE quest_participants SET state='IN_PROGRESS',started_at=?,actor_id=? WHERE quest_id=? AND character_id=?").run(now(), actor.userId, id, characterId);
            else
                await db.prepare('UPDATE quest_participants SET active=0,actor_id=? WHERE quest_id=? AND character_id=?').run(actor.userId, id, characterId);
        }
        await bump(db, 'quests', id);
        const row = await get(db, 'quests', id);
        await revision(db, 'quests', row, actor, action.toUpperCase());
        return await adminDTO(db, 'quests', row);
    });
}
async function storyAccess(db: DB, actor: Session, id: string, action: string, data: Record<string, unknown>) {
    fields(data, ['version']);
    return await transaction(db, async () => {
        const before = await get(db, 'stories', id);
        expected(before, data.version);
        if (action === 'release') {
            const viewer: Viewer = { userId: actor.userId, role: 'PLAYER', characterId: String(before.protagonist_id), preview: true };
            if (before.status !== 'PUBLISHED' || !await eligible(db, viewer, 'stories', before))
                fail(422, 'Publique o arco e confira o acesso do protagonista antes de liberar.');
            await db.prepare('UPDATE personal_story_arcs SET access_active=1,released_at=COALESCE(released_at,?) WHERE id=?').run(now(), id);
        }
        else
            await db.prepare('UPDATE personal_story_arcs SET access_active=0 WHERE id=?').run(id);
        await bump(db, 'stories', id);
        const row = await get(db, 'stories', id);
        await revision(db, 'stories', row, actor, action.toUpperCase());
        return await adminDTO(db, 'stories', row);
    });
}
async function saveEntry(db: DB, actor: Session, id: string, action: string, data: Record<string, unknown>) {
    fields(data, action === 'reorder' ? ['version', 'entryIds'] : action === 'remove' ? ['version', 'entryId'] : ['version', 'entryId', 'payload', 'privateNotes']);
    return await transaction(db, async () => {
        const before = await get(db, 'stories', id);
        expected(before, data.version);
        if (before.status === 'ARCHIVED')
            fail(409, 'Restaure o arco antes de editar.');
        const rows = await entryRows(db, id);
        if (action === 'reorder') {
            const ids = stringIds(data.entryIds);
            if (ids.length !== (data.entryIds as unknown[]).length || ids.length !== rows.length || ids.some(e => !rows.some(r => r.id === e)))
                fail(400, 'Envie a ordem completa dos capítulos.');
            await forEachAsync(ids, async (entry, index) => await db.prepare('UPDATE personal_story_entries SET position=? WHERE id=? AND arc_id=?').run(index, entry, id));
        }
        else {
            const entryId = data.entryId === null ? randomUUID() : text(data.entryId, 100), old = rows.find(r => r.id === entryId);
            if ((action === 'remove' || data.entryId !== null) && !old)
                fail(404, 'Capítulo não encontrado.');
            if (action === 'remove')
                await db.prepare('DELETE FROM personal_story_entries WHERE id=? AND arc_id=?').run(entryId, id);
            else {
                const p = record(data.payload);
                fields(p, ['kind', 'title', 'text', 'npcId', 'locationId', 'fileId', 'alt']);
                if (!['CHAPTER', 'EVENT', 'REVELATION'].includes(String(p.kind)))
                    fail(400, 'Escolha o tipo da entrada.');
                const content = { kind: p.kind, title: text(p.title, 120), text: text(p.text, 4000), npcId: await optional(db, p.npcId, 'npcs'), locationId: await optional(db, p.locationId, 'locations'), fileId: await optional(db, p.fileId, 'workshop_files'), alt: text(p.alt, 300, false) }, notes = text(data.privateNotes ?? '', 2000, false);
                if (!old && rows.length >= 30)
                    fail(400, 'Use até 30 entradas por arco.');
                if (old)
                    await db.prepare('UPDATE personal_story_entries SET draft_json=?,private_notes=? WHERE id=? AND arc_id=?').run(JSON.stringify(content), notes, entryId, id);
                else
                    await db.prepare('INSERT INTO personal_story_entries(id,arc_id,position,draft_json,private_notes) VALUES(?,?,?,?,?)').run(entryId, id, rows.length ? Math.max(...rows.map(r => Number(r.position))) + 1 : 0, JSON.stringify(content), notes);
            }
        }
        await db.prepare("UPDATE personal_story_arcs SET status=CASE WHEN status='PREPARED' THEN 'DRAFT' ELSE status END WHERE id=?").run(id);
        await bump(db, 'stories', id);
        const row = await get(db, 'stories', id);
        await revision(db, 'stories', row, actor, `ENTRY_${action.toUpperCase()}`);
        return await adminDTO(db, 'stories', row);
    });
}
async function revealEntry(db: DB, actor: Session, id: string, revoke: boolean, data: Record<string, unknown>) {
    fields(data, ['version', 'entryId']);
    const entryId = text(data.entryId, 100);
    return await transaction(db, async () => {
        const before = await get(db, 'stories', id);
        expected(before, data.version);
        if (revoke && !await one(db, 'SELECT 1 FROM personal_story_reveals WHERE arc_id=? AND entry_id=?', id, entryId))
            fail(404, 'Entrada revelada não encontrada.');
        if (revoke)
            await db.prepare('UPDATE personal_story_reveals SET active=0,actor_id=?,updated_at=? WHERE arc_id=? AND entry_id=?').run(actor.userId, now(), id, entryId);
        else {
            const viewer: Viewer = { userId: actor.userId, role: 'PLAYER', characterId: String(before.protagonist_id), preview: true };
            if (before.status !== 'PUBLISHED' || !await canRead(db, viewer, 'stories', before))
                fail(409, 'Libere o arco publicado ao protagonista antes de revelar.');
            const prepared = payload(before, true).entries ?? [], position = prepared.findIndex(e => e.id === entryId);
            if (position < 0)
                fail(404, 'Entrada publicada não encontrada.');
            const entry = prepared[position]!;
            ready(entry);
            await db.prepare(`INSERT INTO personal_story_reveals(arc_id,entry_id,character_id,position,snapshot_json,source_revision,actor_id) VALUES(?,?,?,?,?,?,?)
        ON CONFLICT(arc_id,entry_id,character_id) DO UPDATE SET active=1,position=excluded.position,snapshot_json=excluded.snapshot_json,source_revision=excluded.source_revision,actor_id=excluded.actor_id,updated_at=unixepoch()`)
                .run(id, entryId, String(before.protagonist_id), position, JSON.stringify(entry), Number(before.published_revision), actor.userId);
        }
        await bump(db, 'stories', id);
        const row = await get(db, 'stories', id);
        await revision(db, 'stories', row, actor, revoke ? 'ENTRY_REVOKED' : 'ENTRY_REVEALED');
        return await adminDTO(db, 'stories', row);
    });
}
async function list(db: DB, domain: Domain, url: URL, viewer?: Viewer, announcement = false) {
    const q = (url.searchParams.get('q') ?? '').trim().toLocaleLowerCase('pt-BR').slice(0, 120), status = url.searchParams.get('status'), kind = url.searchParams.get('kind');
    const rows = await flatMapAsync((await all(db, `SELECT * FROM ${table(domain)} ORDER BY updated_at DESC,id`)), async (row) => {
        if (viewer && !(announcement ? await canAnnounce(db, viewer, row) : await canRead(db, viewer, domain, row)))
            return [];
        if (!viewer && url.searchParams.get('active') === '1' && (domain !== 'quests' || row.operation_state === 'CLOSED' || !(await participants(db, String(row.id))).some(p => p.active && p.state === 'IN_PROGRESS')))
            return [];
        const p = payload(row, !!viewer), publicValue = viewer ? await project(db, viewer, domain, row, { announcement }) : null, value = publicValue ?? await adminDTO(db, domain, row);
        const known: Array<{
            title: string;
            text: string;
        }> = publicValue && 'entries' in publicValue && Array.isArray(publicValue.entries) ? publicValue.entries : [];
        if ((q && !`${p.title} ${p.summary} ${p.hook} ${known.map(e => e.title + ' ' + e.text).join(' ')}`.toLocaleLowerCase('pt-BR').includes(q)) || (!viewer && status && row.status !== status) || (kind && p.kind !== kind))
            return [];
        return [value];
    });
    const requested = Number(url.searchParams.get('page') ?? 1), page = Number.isInteger(requested) && requested > 0 && requested <= 1000000 ? requested : 1;
    return { items: rows.slice((page - 1) * 12, page * 12), total: rows.length, page, pageSize: 12 };
}
async function cover(db: DB, config: Config, res: ServerResponse, p: {
    fileId: string | null;
}) {
    if (!p.fileId)
        fail(404, 'Imagem indisponível.');
    await renderImage(db, config, res, { fileId: p.fileId, crop: { x: 0, y: 0, width: 100, height: 100 } }, false);
}
const objectiveStates = ['HIDDEN', 'REVEALED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED'];
function publishedDefinition(row: Row, kind: 'objectives' | 'clues', id: string) { return (payload(row, true)[kind] ?? []).find(e => e.id === id); }
async function clueRecord(db: DB, viewer: Viewer, row: Row, clueId: string) {
    if (!await canRead(db, viewer, 'quests', row))
        return null;
    const known = await one(db, 'SELECT * FROM quest_clue_reveals WHERE quest_id=? AND clue_id=? AND character_id=? AND active=1', String(row.id), clueId, viewer.characterId!);
    if (!known)
        return null;
    const saved: Clue = JSON.parse(String(known.snapshot_json)), current = publishedDefinition(row, 'clues', clueId) as Clue | undefined;
    return await policyAllows(db, viewer, current?.policy ?? saved.policy) ? { row: known, saved } : null;
}
async function publicOperations(db: DB, viewer: Viewer, row: Row) {
    if (!await canRead(db, viewer, 'quests', row))
        return { objectives: [], clues: [], outcomes: [] };
    const objectives = await flatMapAsync((await all(db, "SELECT * FROM quest_objective_progress WHERE quest_id=? AND character_id=? AND state<>'HIDDEN' ORDER BY objective_id", String(row.id), viewer.characterId!)), async (progress) => {
        const saved: Objective = JSON.parse(String(progress.snapshot_json)), current = publishedDefinition(row, 'objectives', String(progress.objective_id)) as Objective | undefined;
        if ((current?.internalOnly ?? saved.internalOnly) || !await policyAllows(db, viewer, current?.policy ?? saved.policy))
            return [];
        return [{ id: progress.objective_id, title: saved.title, description: saved.description, optional: saved.optional, state: progress.state }];
    });
    const clues = await flatMapAsync((await all(db, 'SELECT clue_id FROM quest_clue_reveals WHERE quest_id=? AND character_id=? AND active=1 ORDER BY clue_id', String(row.id), viewer.characterId!)), async (r) => {
        const known = await clueRecord(db, viewer, row, String(r.clue_id));
        if (!known)
            return [];
        const c = known.saved;
        return [{ id: c.id, title: c.title, text: c.text, collection: await knownCollectionReference(db, viewer, c.collectionId ?? null), ...await links(db, viewer, c), alt: c.fileId ? c.alt : '', image: c.fileId ? `/api/campaign/quests/${row.id}/clues/${c.id}/image?stamp=${digest(String(known.row.snapshot_json)).slice(0, 20)}` : null }];
    });
    const outcomes = (await all(db, 'SELECT * FROM quest_outcomes WHERE quest_id=? ORDER BY version,id', String(row.id))).filter(r => (JSON.parse(String(r.characters_json)) as string[]).includes(viewer.characterId!)).map(r => ({ id: r.id, ...JSON.parse(String(r.public_json)) as {
            result: string;
            epilogue: string;
            date: string;
        } }));
    const order = (kind: 'objectives' | 'clues', id: unknown) => { const index = (payload(row, true)[kind] ?? []).findIndex(e => e.id === id); return index < 0 ? 1000000 : index; };
    objectives.sort((a, b) => order('objectives', a.id) - order('objectives', b.id));
    clues.sort((a, b) => order('clues', a.id) - order('clues', b.id));
    return { objectives, clues, outcomes };
}
async function saveDefinition(db: DB, actor: Session, id: string, kind: 'objectives' | 'clues', action: string, data: Record<string, unknown>) {
    fields(data, action === 'reorder' ? ['version', 'ids'] : action === 'remove' ? ['version', 'definitionId'] : ['version', 'definitionId', 'payload', 'privateNotes']);
    return await transaction(db, async () => {
        const before = await get(db, 'quests', id);
        expected(before, data.version);
        if (before.status === 'ARCHIVED')
            fail(409, 'Restaure a missão para editar.');
        const rows = await definitions(db, id, kind);
        if (action === 'reorder') {
            const ids = stringIds(data.ids);
            if (ids.length !== (data.ids as unknown[]).length || ids.length !== rows.length || ids.some(value => !rows.some(r => r.id === value)))
                fail(400, 'Envie a ordem completa sem repetições.');
            await forEachAsync(ids, async (value, index) => await db.prepare(`UPDATE quest_${kind} SET position=? WHERE id=? AND quest_id=?`).run(index, value, id));
        }
        else {
            const definitionId = data.definitionId === null ? randomUUID() : text(data.definitionId, 100), old = rows.find(r => r.id === definitionId);
            if ((action === 'remove' || data.definitionId !== null) && !old)
                fail(404, 'Registro não encontrado.');
            if (action === 'remove')
                await db.prepare(`DELETE FROM quest_${kind} WHERE quest_id=? AND id=?`).run(id, definitionId);
            else {
                const p = record(data.payload);
                let content: Record<string, unknown>;
                if (kind === 'objectives') {
                    fields(p, ['title', 'description', 'optional', 'internalOnly', 'policy']);
                    if (typeof p.optional !== 'boolean' || typeof p.internalOnly !== 'boolean')
                        fail(400, 'Confira as opções do objetivo.');
                    content = { title: text(p.title, 120), description: text(p.description, 2000, false), optional: p.optional, internalOnly: p.internalOnly, policy: await validatePolicy(db, p.policy) };
                }
                else {
                    fields(p, ['title', 'text', 'fileId', 'alt', 'npcId', 'locationId', 'policy', 'collectionId']);
                    const collectionId = p.collectionId == null ? null : text(p.collectionId, 100);
                    if (collectionId && !await one(db, "SELECT id FROM content_records WHERE id=? AND kind IN('chocolatecards','bestiary','rarities','memories','curiosities')", collectionId))
                        fail(400, 'Coleção indisponível.');
                    content = { collectionId, kind: 'REVELATION', title: text(p.title, 120), text: text(p.text, 4000), fileId: await optional(db, p.fileId, 'workshop_files'), alt: text(p.alt, 300, false), npcId: await optional(db, p.npcId, 'npcs'), locationId: await optional(db, p.locationId, 'locations'), policy: await validatePolicy(db, p.policy) };
                }
                const notes = text(data.privateNotes ?? '', 2000, false);
                if (!old && rows.length >= 50)
                    fail(400, 'Use até 50 registros de cada tipo por missão.');
                if (old)
                    await db.prepare(`UPDATE quest_${kind} SET draft_json=?,private_notes=? WHERE quest_id=? AND id=?`).run(JSON.stringify(content), notes, id, definitionId);
                else
                    await db.prepare(`INSERT INTO quest_${kind}(id,quest_id,position,draft_json,private_notes) VALUES(?,?,?,?,?)`).run(definitionId, id, rows.length ? Math.max(...rows.map(r => Number(r.position))) + 1 : 0, JSON.stringify(content), notes);
            }
        }
        await db.prepare("UPDATE quests SET status=CASE WHEN status='PREPARED' THEN 'DRAFT' ELSE status END WHERE id=?").run(id);
        await bump(db, 'quests', id);
        const row = await get(db, 'quests', id);
        await revision(db, 'quests', row, actor, `${kind.toUpperCase()}_${action.toUpperCase()}`);
        return await adminDTO(db, 'quests', row);
    });
}
async function updateObjective(db: DB, actor: Session, id: string, data: Record<string, unknown>) {
    fields(data, ['version', 'objectiveId', 'characters', 'state']);
    const objectiveId = text(data.objectiveId, 100), characters = stringIds(data.characters), state = text(data.state, 30);
    if (!characters.length || !objectiveStates.includes(state))
        fail(400, 'Selecione personagens e um estado válido.');
    await forEachAsync(characters, async (c) => await exists(db, 'characters', c));
    return await transaction(db, async () => {
        const before = await get(db, 'quests', id);
        expected(before, data.version);
        if ((before.status !== 'PUBLISHED' || before.operation_state === 'CLOSED') && state !== 'HIDDEN')
            fail(409, 'A missão deve estar publicada e aberta para atualizar progresso.');
        const definition = before.published_json ? publishedDefinition(before, 'objectives', objectiveId) as Objective | undefined : undefined;
        for (const characterId of characters) {
            const viewer: Viewer = { userId: actor.userId, role: 'PLAYER', characterId, preview: true };
            if (state !== 'HIDDEN' && (!definition || !await canRead(db, viewer, 'quests', before) || !await policyAllows(db, viewer, definition.policy)))
                fail(422, 'Um destinatário não pode consultar este objetivo.');
        }
        for (const character of characters) {
            if (state === 'HIDDEN')
                await db.prepare("UPDATE quest_objective_progress SET state='HIDDEN',actor_id=? WHERE quest_id=? AND objective_id=? AND character_id=?").run(actor.userId, id, objectiveId, character);
            else
                await db.prepare(`INSERT INTO quest_objective_progress(quest_id,objective_id,character_id,state,snapshot_json,source_revision,actor_id) VALUES(?,?,?,?,?,?,?)
        ON CONFLICT(quest_id,objective_id,character_id) DO UPDATE SET state=excluded.state,snapshot_json=excluded.snapshot_json,source_revision=excluded.source_revision,actor_id=excluded.actor_id`).run(id, objectiveId, character, state, JSON.stringify(definition), Number(before.published_revision), actor.userId);
        }
        await bump(db, 'quests', id);
        const row = await get(db, 'quests', id);
        await revision(db, 'quests', row, actor, 'OBJECTIVE_UPDATED');
        return await adminDTO(db, 'quests', row);
    });
}
async function revealClue(db: DB, actor: Session, id: string, revoke: boolean, data: Record<string, unknown>) {
    fields(data, revoke ? ['version', 'clueId', 'characters'] : ['version', 'clueId', 'characters', 'presentation']);
    const clueId = text(data.clueId, 100), characters = stringIds(data.characters);
    if (!characters.length || (!revoke && !['ANIMATED', 'SILENT'].includes(String(data.presentation))))
        fail(400, 'Selecione destinatários e apresentação.');
    await forEachAsync(characters, async (c) => await exists(db, 'characters', c));
    return await transaction(db, async () => {
        const before = await get(db, 'quests', id);
        expected(before, data.version);
        const clue = before.published_json ? publishedDefinition(before, 'clues', clueId) as Clue | undefined : undefined;
        if (!revoke) {
            if (before.status !== 'PUBLISHED' || before.operation_state === 'CLOSED' || !clue)
                fail(409, 'Publique a pista em uma missão aberta.');
            ready(clue);
            for (const characterId of characters) {
                const viewer: Viewer = { userId: actor.userId, role: 'PLAYER', characterId, preview: true };
                if (!await canRead(db, viewer, 'quests', before) || !await policyAllows(db, viewer, clue.policy))
                    fail(422, 'Um destinatário não pode receber esta pista.');
            }
        }
        for (const character of characters) {
            if (revoke)
                await db.prepare('UPDATE quest_clue_reveals SET active=0,actor_id=? WHERE quest_id=? AND clue_id=? AND character_id=?').run(actor.userId, id, clueId, character);
            else {
                const eventId = await enqueue(db, character, 'QUEST_CLUE', id, clueId, String(data.presentation));
                await db.prepare(`INSERT INTO quest_clue_reveals(quest_id,clue_id,character_id,snapshot_json,source_revision,actor_id,event_id) VALUES(?,?,?,?,?,?,?)
        ON CONFLICT(quest_id,clue_id,character_id) DO UPDATE SET active=1,snapshot_json=excluded.snapshot_json,source_revision=excluded.source_revision,actor_id=excluded.actor_id,event_id=excluded.event_id`)
                    .run(id, clueId, character, JSON.stringify(clue), Number(before.published_revision), actor.userId, eventId);
            }
        }
        await bump(db, 'quests', id);
        const row = await get(db, 'quests', id);
        await revision(db, 'quests', row, actor, revoke ? 'CLUE_REVOKED' : 'CLUE_REVEALED');
        return await adminDTO(db, 'quests', row);
    });
}
async function outcomeCommand(db: DB, actor: Session, id: string, reopen: boolean, data: Record<string, unknown>) {
    fields(data, reopen ? ['version', 'reason'] : ['version', 'result', 'epilogue', 'date', 'privateNotes']);
    return await transaction(db, async () => {
        const before = await get(db, 'quests', id);
        expected(before, data.version);
        if (before.status !== 'PUBLISHED')
            fail(409, 'Publique/restaure a missão antes desta operação.');
        if (reopen) {
            if (before.operation_state !== 'CLOSED')
                fail(409, 'A missão não está encerrada.');
            const reason = text(data.reason, 2000);
            await db.prepare("UPDATE quests SET operation_state='OPEN' WHERE id=?").run(id);
            await audit(db, actor.userId, 'QUEST_REOPEN_REASON', 'QUEST', id, { reason });
        }
        else {
            if (before.operation_state === 'CLOSED')
                fail(409, 'A missão já está encerrada.');
            if (!['SUCCESS', 'PARTIAL_SUCCESS', 'FAILURE'].includes(String(data.result)))
                fail(400, 'Escolha o desfecho.');
            const members = await filterAsync((await participants(db, id)), async (m) => !!m.active && await canRead(db, { userId: actor.userId, role: 'PLAYER', characterId: String(m.character_id), preview: true }, 'quests', before));
            if (!members.some(m => m.state === 'IN_PROGRESS'))
                fail(409, 'Inicie a missão para pelo menos um participante antes de encerrar.');
            const content = { result: String(data.result), epilogue: text(data.epilogue, 4000), date: text(data.date ?? '', 100, false) }, notes = text(data.privateNotes ?? '', 2000, false);
            await db.prepare('INSERT INTO quest_outcomes(id,quest_id,version,actor_id,public_json,private_notes,characters_json) VALUES(?,?,?,?,?,?,?)').run(randomUUID(), id, Number(before.version) + 1, actor.userId, JSON.stringify(content), notes, JSON.stringify(members.map(m => m.character_id)));
            await db.prepare("UPDATE quests SET operation_state='CLOSED' WHERE id=?").run(id);
        }
        await bump(db, 'quests', id);
        const row = await get(db, 'quests', id);
        await revision(db, 'quests', row, actor, reopen ? 'REOPENED' : 'CLOSED');
        return await adminDTO(db, 'quests', row);
    });
}
registerEvent('QUEST_CLUE', async (db, viewer, event) => {
    const row = await one(db, 'SELECT * FROM quests WHERE id=?', String(event.resource_id));
    if (!row)
        return null;
    const known = await clueRecord(db, viewer, row, String(event.fragment_id));
    return known && known.row.event_id === event.id ? { title: known.saved.title, text: known.saved.text, href: `/portal/missoes/grupo/${row.id}` } : null;
});
export { get as campaignGet, canRead as campaignCanRead, links as campaignLinks, bump as campaignBump, revision as campaignRevision, adminDTO as campaignAdminDTO };
export async function handleCampaign(req: IncomingMessage, res: ServerResponse, url: URL, db: DB, config: Config, session?: Session): Promise<boolean> {
    const path = url.pathname, method = req.method ?? 'GET', admin = path.startsWith('/api/master/campaign');
    if (!admin && !path.startsWith('/api/campaign'))
        return false;
    if (admin) {
        const actor = requireMaster(session);
        if (url.searchParams.has('view_as'))
            fail(403, 'Saia da visualização para administrar.');
        if (path === '/api/master/campaign/context' && method === 'GET') {
            send(res, 200, { collections: (await all(db, "SELECT id,draft_json FROM content_records WHERE kind IN('chocolatecards','bestiary','rarities','memories','curiosities')")).map(r => ({ id: r.id, name: JSON.parse(String(r.draft_json)).title })), npcs: (await all(db, 'SELECT id,status,draft_json FROM npcs ORDER BY id')).map(r => ({ id: r.id, status: r.status, name: JSON.parse(String(r.draft_json)).name })) });
            return true;
        }
        const match = path.match(/^\/api\/master\/campaign\/(quests|stories)(?:\/([\w-]+))?(?:\/(history|preview|preview-image|prepare|publish|duplicate|archive|restore|release|revoke|start|entries|reorder|reveal-entry|revoke-entry|objectives|clues|reorder-objectives|reorder-clues|objective-state|reveal-clue|revoke-clue|close|reopen))?$/);
        if (match) {
            const domain = match[1] as Domain, id = match[2], action = match[3];
            if (!id) {
                if (method === 'GET') {
                    send(res, 200, await list(db, domain, url));
                    return true;
                }
                if (method === 'POST') {
                    send(res, 201, await create(db, domain, actor, await jsonBody(req, 131072)));
                    return true;
                }
            }
            else {
                const row = await get(db, domain, id);
                if (!action && method === 'GET') {
                    send(res, 200, await adminDTO(db, domain, row));
                    return true;
                }
                if (!action && method === 'PATCH') {
                    send(res, 200, await save(db, domain, actor, id, await jsonBody(req, 131072)));
                    return true;
                }
                if (action === 'history' && method === 'GET') {
                    const requested = Number(url.searchParams.get('page') ?? 1), page = Number.isSafeInteger(requested) && requested > 0 && requested <= 100000 ? requested : 1;
                    send(res, 200, { items: (await all(db, `SELECT version,actor_id,action,snapshot_json,created_at FROM ${revisionTable(domain)} WHERE record_id=? ORDER BY version DESC LIMIT 20 OFFSET ?`, id, (page - 1) * 20)).map(r => ({ version: r.version, actorId: r.actor_id, action: r.action, createdAt: r.created_at, snapshot: JSON.parse(String(r.snapshot_json)) })) });
                    return true;
                }
                if ((action === 'preview' || action === 'preview-image') && method === 'GET') {
                    const characterId = text(url.searchParams.get('character'), 100);
                    await exists(db, 'characters', characterId);
                    const source = url.searchParams.get('source') ?? 'draft', mode = url.searchParams.get('mode') ?? 'diary';
                    if (!['draft', 'published'].includes(source) || !['diary', 'announcement'].includes(mode) || (domain === 'stories' && mode === 'announcement'))
                        fail(400, 'Prévia inválida.');
                    const viewer: Viewer = { userId: actor.userId, role: 'PLAYER', characterId, preview: true }, isDraft = source === 'draft', announcement = mode === 'announcement';
                    const allowed = isDraft ? row.status !== 'ARCHIVED' && await eligible(db, viewer, domain, row, true) : (announcement ? await canAnnounce(db, viewer, row) : await canRead(db, viewer, domain, row));
                    const imageURL = `/api/master/campaign/${domain}/${id}/preview-image?character=${encodeURIComponent(characterId)}&source=${source}&mode=${mode}&version=${row.version}`;
                    if (action === 'preview') {
                        send(res, 200, { accessible: allowed, preview: true, inDiary: await canRead(db, viewer, domain, row), record: allowed ? await project(db, viewer, domain, row, { draft: isDraft, announcement, imageURL }) : null });
                        return true;
                    }
                    if (!allowed || String(row.version) !== url.searchParams.get('version'))
                        fail(404, 'Imagem indisponível.');
                    await cover(db, config, res, payload(row, !isDraft));
                    return true;
                }
                if (method === 'POST') {
                    const data = await jsonBody(req);
                    if (domain === 'quests' && action) {
                        if (['objectives', 'clues', 'reorder-objectives', 'reorder-clues'].includes(action)) {
                            const kind = action.includes('objectives') ? 'objectives' : 'clues';
                            send(res, 200, await saveDefinition(db, actor, id, kind, action.startsWith('reorder') ? 'reorder' : 'save', data));
                            return true;
                        }
                        if (action === 'objective-state') {
                            send(res, 200, await updateObjective(db, actor, id, data));
                            return true;
                        }
                        if (action === 'reveal-clue' || action === 'revoke-clue') {
                            send(res, 200, await revealClue(db, actor, id, action === 'revoke-clue', data));
                            return true;
                        }
                        if (action === 'close' || action === 'reopen') {
                            send(res, 200, await outcomeCommand(db, actor, id, action === 'reopen', data));
                            return true;
                        }
                    }
                    if (action === 'duplicate') {
                        send(res, 200, await duplicate(db, domain, actor, id, data));
                        return true;
                    }
                    if (action && ['prepare', 'publish', 'archive', 'restore'].includes(action)) {
                        send(res, 200, await command(db, domain, actor, id, action, data));
                        return true;
                    }
                    if (action && ['release', 'revoke', 'start'].includes(action) && (domain === 'quests' || action !== 'start')) {
                        send(res, 200, domain === 'quests' ? await questAccess(db, actor, id, action, data) : await storyAccess(db, actor, id, action, data));
                        return true;
                    }
                    if (domain === 'stories' && (action === 'entries' || action === 'reorder')) {
                        send(res, 200, await saveEntry(db, actor, id, action === 'entries' ? 'save' : 'reorder', data));
                        return true;
                    }
                    if (domain === 'stories' && (action === 'reveal-entry' || action === 'revoke-entry')) {
                        send(res, 200, await revealEntry(db, actor, id, action === 'revoke-entry', data));
                        return true;
                    }
                }
                if (domain === 'quests' && (action === 'objectives' || action === 'clues') && method === 'DELETE') {
                    send(res, 200, await saveDefinition(db, actor, id, action, 'remove', await jsonBody(req)));
                    return true;
                }
                if (domain === 'stories' && action === 'entries' && method === 'DELETE') {
                    send(res, 200, await saveEntry(db, actor, id, 'remove', await jsonBody(req)));
                    return true;
                }
            }
        }
        fail(404, 'Recurso não encontrado.');
    }
    const viewer = await viewerFor(db, requireSession(session), url);
    const clueImage = path.match(/^\/api\/campaign\/quests\/([\w-]+)\/clues\/([\w-]+)\/image$/);
    if (clueImage && method === 'GET') {
        const row = await get(db, 'quests', clueImage[1]!), known = await clueRecord(db, viewer, row, clueImage[2]!);
        if (!known || url.searchParams.get('stamp') !== digest(String(known.row.snapshot_json)).slice(0, 20))
            fail(404, 'Imagem indisponível.');
        await cover(db, config, res, known.saved);
        return true;
    }
    const match = path.match(/^\/api\/campaign\/(quests|stories|announcements)(?:\/([\w-]+))?(?:\/(image)|\/entries\/([\w-]+)\/image)?$/);
    if (match && method === 'GET') {
        const domain: Domain = match[1] === 'stories' ? 'stories' : 'quests', announcement = match[1] === 'announcements', id = match[2];
        if (!id) {
            send(res, 200, await list(db, domain, url, viewer, announcement));
            return true;
        }
        const row = await get(db, domain, id);
        if (!(announcement ? await canAnnounce(db, viewer, row) : await canRead(db, viewer, domain, row)))
            fail(404, 'Registro não encontrado.');
        if (match[4]) {
            if (domain !== 'stories' || announcement)
                fail(404, 'Imagem indisponível.');
            const known = await one(db, 'SELECT * FROM personal_story_reveals WHERE arc_id=? AND entry_id=? AND character_id=? AND active=1', id, match[4], viewer.characterId!);
            if (!known || url.searchParams.get('stamp') !== entryStamp(known))
                fail(404, 'Imagem indisponível.');
            await cover(db, config, res, JSON.parse(String(known.snapshot_json)));
            return true;
        }
        if (match[3]) {
            const context = url.searchParams.get('context');
            if (context === 'announcement') {
                if (domain !== 'quests' || !await canAnnounce(db, viewer, row))
                    fail(404, 'Imagem indisponível.');
            }
            else if (context !== 'diary' || !await canRead(db, viewer, domain, row))
                fail(404, 'Imagem indisponível.');
            if (url.searchParams.get('stamp') !== imageStamp(row))
                fail(404, 'Imagem indisponível.');
            await cover(db, config, res, payload(row, true));
            return true;
        }
        send(res, 200, await project(db, viewer, domain, row, { announcement }));
        return true;
    }
    fail(404, 'Recurso não encontrado.');
}
export async function campaignAnnouncementReference(db: DB, viewer: Viewer, id: string) {
    const row = await one(db, 'SELECT * FROM quests WHERE id=?', id);
    if (!row || !await canAnnounce(db, viewer, row))
        return null;
    return { id: row.id, title: payload(row, true).title };
}
async function knownCollectionReference(db: DB, viewer: Viewer, id: string | null) {
    if (!id)
        return null;
    const row = await one(db, 'SELECT * FROM content_records WHERE id=?', id);
    if (!row || !await contentAllowed(db, viewer, row))
        return null;
    const known = await one(db, 'SELECT snapshot_json FROM collection_discoveries WHERE record_id=? AND character_id=? AND active=1', id, viewer.characterId);
    if (!known)
        return null;
    return { title: JSON.parse(String(known.snapshot_json)).title, href: '/portal/conteudos/' + row.kind + '/' + row.id };
}
