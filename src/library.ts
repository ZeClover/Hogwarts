import { flatMapAsync } from './async-array.ts';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { all, one, type DB, type Row } from './db.ts';
import { fail, digest, requireSession, viewerFor, type Viewer, type Session } from './auth.ts';
import { fields, stringIds } from './http.ts';
import { policyAllows, type Policy } from './editorial.ts';
import { registerContent, registerReference, contentPayload, contentPolicy, contentAllowed, contentRevision, contentRecord, contentAdmin, type Field, type ContentPayload } from './content.ts';
import { enqueue, registerEvent } from './events.ts';
import { npcReference } from './npcs.ts';
import { renderImage } from './workshop.ts';
import type { Config } from './config.ts';
type Page = {
    id: string;
    title: string;
    text: string;
    fileId: string | null;
    alt: string;
    policy: Policy;
};
const pages = (row: Row, published = true) => (contentPayload(row, published).pages ?? []) as Page[];
const rows = async (db: DB, id: string) => await all(db, 'SELECT * FROM content_page_reveals WHERE record_id=? ORDER BY position,page_id,character_id', id);
export async function libraryPages(db: DB, v: Viewer, row: Row) {
    return await flatMapAsync((await rows(db, String(row.id))).filter(r => r.active && r.character_id === v.characterId), async (r) => {
        const snapshot = JSON.parse(String(r.snapshot_json)) as Page, live = pages(row).find(p => p.id === r.page_id);
        if (!await policyAllows(db, v, live?.policy ?? snapshot.policy))
            return [];
        return [{ id: r.page_id, title: snapshot.title, text: snapshot.text, image: snapshot.fileId ? `/api/library/${row.id}/pages/${r.page_id}/image?stamp=${digest(String(r.snapshot_json)).slice(0, 20)}` : null, alt: snapshot.alt }];
    });
}
export const pageFields: Field[] = [{ name: 'id', label: 'Identificador da página', type: 'id' }, { name: 'title', label: 'Título da página', required: true, max: 120 }, { name: 'text', label: 'Conteúdo da página', type: 'richtext', max: 16000 }, { name: 'fileId', label: 'Ilustração da página', type: 'image' }, { name: 'alt', label: 'Texto alternativo da página', max: 300 }, { name: 'policy', label: 'Restrições da página', type: 'policy' }];
const common: Field[] = [{ name: 'title', label: 'Título da obra', required: true, max: 180 }, { name: 'description', label: 'Sinopse', type: 'textarea', max: 4000 }, {name:'authorText',label:'Autor ou professor (nome livre)',max:180}, { name: 'subject', label: 'Matéria ou assunto', max: 180 }, { name: 'npcId', label: 'Autor ou professor conhecido', type: 'reference', source: 'npcs' }, { name: 'fileId', label: 'Capa opcional', type: 'image', advanced: true }, { name: 'alt', label: 'Texto alternativo', max: 300, advanced: true }, { name: 'pages', label: 'Páginas e capítulos', type: 'blocks', fields: pageFields, max: 50 }];
export function libraryValidate(_db: DB, p: ContentPayload) {
    const entries = p.pages as Page[], ids = new Set(entries.map(p => p.id));
    if (ids.size !== entries.length)
        fail(400, 'Cada página precisa ter um identificador próprio.');
    for (const page of entries)
        if (page.fileId && !page.alt)
            fail(422, 'Preencha o texto alternativo das ilustrações.');
}
export async function libraryAdmin(db: DB, row: Row) { return { pages: row.published_json ? pages(row).map(p => ({ id: p.id, title: p.title })) : [], reveals: (await rows(db, String(row.id))).map(r => ({ pageId: r.page_id, characterId: r.character_id, active: !!r.active, title: JSON.parse(String(r.snapshot_json)).title })) }; }
export async function libraryPageAction(db: DB, actor: Session, row: Row, action: string, data: Record<string, unknown>) {
    if (!['reveal-pages', 'revoke-pages'].includes(action))
        fail(404, 'Ação não encontrada.');
    fields(data, ['version', 'pageIds', 'characters', 'presentation']);
    const ids = stringIds(data.pageIds), chars = stringIds(data.characters);
    if (!ids.length || !chars.length)
        fail(422, 'Selecione páginas e destinatários.');
    const reveal = action === 'reveal-pages';
    if (reveal && row.status !== 'PUBLISHED')
        fail(409, 'Publique antes de revelar páginas.');
    if (reveal && !['ANIMATED', 'SILENT'].includes(String(data.presentation)))
        fail(400, 'Escolha a apresentação.');
    const known = await rows(db, String(row.id)), published = row.published_json ? pages(row) : [];
    for (const char of chars) {
        if (!await one(db, 'SELECT id FROM characters WHERE id=?', char))
            fail(400, 'Personagem indisponível.');
        const v: Viewer = { role: 'PLAYER', userId: actor.userId, characterId: char, preview: false };
        for (const id of ids) {
            const page = published.find(p => p.id === id);
            if (reveal && (!page || !await policyAllows(db, v, contentPolicy(row)) || !await policyAllows(db, v, page.policy)))
                fail(422, 'Uma página não está autorizada para todos os selecionados.');
            if (!reveal && !known.some(r => r.page_id === id && r.character_id === char))
                fail(422, 'Uma página selecionada não foi revelada a este destinatário.');
        }
    }
    for (const char of chars)
        for (const id of ids) {
            if (reveal) {
                const page = published.find(p => p.id === id)!, event = await enqueue(db, char, 'LIBRARY_PAGE', String(row.id), id, String(data.presentation));
                await db.prepare('INSERT INTO content_page_reveals(record_id,page_id,character_id,position,snapshot_json,source_revision,event_id,actor_id) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(record_id,page_id,character_id) DO UPDATE SET active=1,position=excluded.position,snapshot_json=excluded.snapshot_json,source_revision=excluded.source_revision,event_id=excluded.event_id,actor_id=excluded.actor_id').run(String(row.id), id, char, published.indexOf(page), JSON.stringify(page), Number(row.published_revision), event, actor.userId);
            }
            else
                await db.prepare('UPDATE content_page_reveals SET active=0 WHERE record_id=? AND page_id=? AND character_id=?').run(String(row.id), id, char);
        }
    await db.prepare('UPDATE content_records SET version=version+1 WHERE id=?').run(String(row.id));
    const next = await contentRecord(db, String(row.kind), String(row.id));
    await contentRevision(db, next, actor, action.toUpperCase());
    return await contentAdmin(db, next);
}
for (const kind of ['books', 'lessons'])
    registerContent(kind, { label: kind === 'books' ? 'Livros e Biblioteca' : 'Aulas', singular: kind === 'books' ? 'Livro' : 'Aula', retainArchive: true, fields: [...common, ...(kind === 'books' ? [{ name: 'author', label: 'Autoria conhecida', max: 180 }, { name: 'category', label: 'Acervo', type: 'select', options: ['NORMAL', 'RARE'], required: true }] as Field[] : [{ name: 'academicYear', label: 'Ano letivo', type: 'reference', source: 'years', required: true }, {name:'schoolYear',label:'Ano escolar do aluno',type:'number',min:1,max:7}, { name: 'level', label: 'Nível', type: 'select', options: ['Fundamentos', 'Prática', 'Aprofundamento'], required: true }, { name: 'prerequisites', label: 'Pré-requisitos informativos', type: 'textarea', advanced: true, max: 2000 }, { name: 'exercises', label: 'Exercícios opcionais', type: 'richtext', advanced: true, max: 8000 }] as Field[])], validate: libraryValidate, admin: libraryAdmin, action: libraryPageAction,
        duplicate: p => ({ ...p, pages: (p.pages as Page[]).map(page => ({ ...page, id: randomUUID() })) }), listed: row => kind !== 'books' || contentPayload(row).category !== 'RARE',
        allowed: async (db, v, row, p) => kind !== 'books' || p.category !== 'RARE' || (await libraryPages(db, v, row)).length > 0,
        project: async (db, v, row, p) => ({ title: p.title, description: p.description, meta: [p.subject, p.authorText||p.author, p.level, p.schoolYear?String(p.schoolYear)+'º ano':''].filter(Boolean), npc: p.npcId ? await npcReference(db, v, String(p.npcId)) : null, sections: row.published_json ? await libraryPages(db, v, row) : [], ...(kind === 'lessons' ? { body: [p.prerequisites, p.exercises].filter(Boolean).join('\n\n') } : {}) }) });
registerReference('books', async (db) => (await all(db, "SELECT id,draft_json FROM content_records WHERE kind='books'")).map(r => ({ id: String(r.id), name: String(contentPayload(r, false).title) })));
registerReference('lessons', async (db) => (await all(db, "SELECT id,draft_json FROM content_records WHERE kind='lessons'")).map(r => ({ id: String(r.id), name: String(contentPayload(r, false).title) })));
const progressiveKinds = new Set(['books', 'lessons']);
export function registerProgressiveKind(kind: string) { progressiveKinds.add(kind); }
registerEvent('LIBRARY_PAGE', async (db, v, event) => {
    const row = await one(db, "SELECT * FROM content_records WHERE id=?", String(event.resource_id));
    if (!row || !progressiveKinds.has(String(row.kind)) || !await contentAllowed(db, v, row))
        return null;
    const grant = await one(db, 'SELECT event_id FROM content_page_reveals WHERE record_id=? AND page_id=? AND character_id=? AND active=1', String(row.id), String(event.fragment_id), v.characterId);
    const page = (await libraryPages(db, v, row)).find(p => p.id === event.fragment_id);
    return grant?.event_id === event.id && page ? { kind: 'NOVA PÁGINA DESCOBERTA', title: page.title, text: page.text, image: page.image, alt: page.alt, href: '/portal/conteudos/' + row.kind + '/' + row.id } : null;
});
export async function handleLibrary(req: IncomingMessage, res: ServerResponse, url: URL, db: DB, config: Config, session?: Session): Promise<boolean> {
    const match = url.pathname.match(/^\/api\/library\/([\w-]+)\/pages\/([\w-]+)\/image$/);
    if (!match)
        return false;
    const viewer = await viewerFor(db, requireSession(session), url), row = await one(db, "SELECT * FROM content_records WHERE id=?", match[1]!) ?? fail(404, 'Página não encontrada.');
    if (!progressiveKinds.has(String(row.kind)) || req.method !== 'GET' || !await contentAllowed(db, viewer, row))
        fail(404, 'Página não encontrada.');
    const known = (await libraryPages(db, viewer, row)).find(p => p.id === match[2]);
    if (!known?.image)
        fail(404, 'Imagem indisponível.');
    const grant = (await one(db, 'SELECT snapshot_json FROM content_page_reveals WHERE record_id=? AND page_id=? AND character_id=? AND active=1', String(row.id), match[2]!, viewer.characterId))!;
    if (url.searchParams.get('stamp') !== digest(String(grant.snapshot_json)).slice(0, 20))
        fail(404, 'Imagem indisponível.');
    const page = JSON.parse(String(grant.snapshot_json)) as Page;
    await renderImage(db, config, res, { fileId: page.fileId!, crop: { x: 0, y: 0, width: 100, height: 100 } }, false);
    return true;
}
