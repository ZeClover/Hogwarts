import type { IncomingMessage, ServerResponse } from 'node:http';
import { all, one, type DB } from './db.ts';
import { fail, requireMaster, type Session } from './auth.ts';
import { send } from './http.ts';

// All six persisted editorial sources are queried together, before pagination.
// No administrative aggregation is exposed through player state or view_as.
const sources = [
    ['npcs', 'npcs', '/portal/mestre/oficinas/npcs', '/portal/personagens'],
    ['catalog_items', 'items', '/portal/mestre/oficinas/itens', '/portal/artigos'],
    ['quests', 'quests', '/portal/mestre/oficinas/missoes', '/portal/oportunidades'],
    ['personal_story_arcs', 'stories', '/portal/mestre/oficinas/historias', '/portal/missoes/historias'],
    ['editorial_entries', 'media', '/portal/mestre/oficinas/midias', '/portal/midias']
] as const;
const union = sources.map(([table, kind, editor, publication]) => `SELECT id,'${kind}' kind,status,updated_at,
    COALESCE(json_extract(draft_json,'$.title'),json_extract(draft_json,'$.name'),'Sem título') title,
    COALESCE(json_extract(draft_json,'$.fileId'),json_extract(draft_json,'$.portraitFileId')) file_id,
    published_json IS NOT NULL AND (draft_json!=published_json OR draft_policy_json!=published_policy_json) pending,
    published_revision,'${editor}/' editor,'${publication}/' publication FROM ${table}`).join(' UNION ALL ') + ` UNION ALL
    SELECT id,kind,status,updated_at,COALESCE(json_extract(draft_json,'$.title'),'Sem título') title,
    json_extract(draft_json,'$.fileId') file_id,
    published_json IS NOT NULL AND (draft_json!=published_json OR draft_policy_json!=published_policy_json OR COALESCE(draft_template_json,'')!=COALESCE(published_template_json,'')) pending,
    published_revision,'/portal/mestre/oficinas/conteudos/'||kind||'/' editor,'/portal/conteudos/'||kind||'/' publication FROM content_records`;

export async function handleCreations(req: IncomingMessage, res: ServerResponse, url: URL, db: DB, session?: Session): Promise<boolean> {
    if (url.pathname !== '/api/master/creations') return false;
    requireMaster(session);
    if (url.searchParams.has('view_as')) fail(403, 'Saia da prévia para consultar suas criações.');
    if (req.method !== 'GET') fail(405, 'Método não permitido.');
    const page = Number(url.searchParams.get('page') ?? 1), pageSize = 24;
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) fail(400, 'Confira a página.');
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 120).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(), kind = (url.searchParams.get('kind') ?? '').slice(0, 40);
    const status = url.searchParams.get('status') ?? 'IN_PROGRESS';
    if (!['IN_PROGRESS', 'DRAFT', 'PREPARED', 'PUBLISHED', 'ARCHIVED', 'ALL'].includes(status)) fail(400, 'Confira o estado.');
    // GLOB character classes fold Portuguese case/accents without database
    // extensions, migrations or deeply nested SQL functions (libSQL compatible).
    const variants: Record<string, string> = { a: 'aAáàâãäÁÀÂÃÄ', e: 'eEéèêëÉÈÊË', i: 'iIíìîïÍÌÎÏ', o: 'oOóòôõöÓÒÔÕÖ', u: 'uUúùûüÚÙÛÜ', c: 'cCçÇ' };
    const pattern = [...q].map(char => variants[char] ? `[${variants[char]}]` : /[a-z]/.test(char) ? `[${char}${char.toUpperCase()}]` : char === '[' ? '[[]' : char === ']' ? '[]]' : char === '*' ? '[*]' : char === '?' ? '[?]' : char).join('');
    const params = [q, '*' + pattern + '*', kind, kind];
    const base = `WITH creations AS (${union}), filtered AS (SELECT * FROM creations WHERE (?='' OR title GLOB ?) AND (?='' OR kind=?))`;
    const groups = await all(db, `${base} SELECT status,COUNT(*) n,SUM(CASE WHEN pending THEN 1 ELSE 0 END) pending FROM filtered GROUP BY status`, ...params);
    const counts: Record<string, number> = { ALL: 0, IN_PROGRESS: 0, DRAFT: 0, PREPARED: 0, PUBLISHED: 0, ARCHIVED: 0 };
    for (const row of groups) {
        const n = Number(row.n); counts[String(row.status)] = n; counts.ALL! += n;
        if (row.status === 'DRAFT' || row.status === 'PREPARED') counts.IN_PROGRESS! += n;
        if (row.status === 'PUBLISHED') counts.IN_PROGRESS! += Number(row.pending);
    }
    const where = status === 'ALL' ? '1' : status === 'IN_PROGRESS' ? "status IN ('DRAFT','PREPARED') OR (status='PUBLISHED' AND pending)" : 'status=?';
    const filterParams = status === 'ALL' || status === 'IN_PROGRESS' ? [] : [status];
    const total = Number((await one(db, `${base} SELECT COUNT(*) n FROM filtered WHERE ${where}`, ...params, ...filterParams))!.n);
    const rows = await all(db, `${base} SELECT * FROM filtered WHERE ${where} ORDER BY updated_at DESC,kind,id LIMIT ? OFFSET ?`, ...params, ...filterParams, pageSize, (page - 1) * pageSize);
    send(res, 200, { items: rows.map(row => ({ id: row.id, kind: row.kind, title: row.title, status: row.status, updatedAt: row.updated_at,
        hasUnpublishedChanges: !!row.pending, editorHref: String(row.editor) + row.id,
        publishedHref: row.published_revision ? String(row.publication) + row.id : null,
        image: row.file_id ? '/api/master/workshop/files/' + encodeURIComponent(String(row.file_id)) : null })), total, page, pageSize, counts });
    return true;
}
