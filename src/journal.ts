import { mapAsync } from './async-array.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { all, one, type DB, type Row } from './db.ts';
import { requireMaster, requireSession, viewerFor, fail, type Session, type Viewer } from './auth.ts';
import { registerContent, contentPayload, contentAllowed, type Field, type ContentPayload } from './content.ts';
import { imageStamp } from './editorial.ts';
import { enqueue, registerEvent } from './events.ts';
import { npcReference } from './npcs.ts';
import { renderImage } from './workshop.ts';
import type { Config } from './config.ts';
export const articleFields: Field[] = [{ name: 'id', label: 'Identificador do bloco', type: 'id' }, { name: 'title', label: 'Título do artigo', required: true, max: 180 }, { name: 'author', label: 'Autoria do artigo', max: 180 }, { name: 'npcId', label: 'NPC relacionado', type: 'reference', source: 'npcs' }, { name: 'text', label: 'Texto do artigo', type: 'richtext', max: 16000 }, { name: 'fileId', label: 'Imagem do artigo', type: 'image' }, { name: 'alt', label: 'Descrição da imagem do artigo', max: 300 }];
export const documentFields: Field[] = [{ name: 'title', label: 'Título da edição', required: true, max: 180 }, { name: 'academicYear', label: 'Ano letivo', type: 'reference', source: 'years', required: true }, { name: 'description', label: 'Apresentação', type: 'textarea', max: 4000 }, { name: 'fileId', label: 'Capa opcional', type: 'image', advanced: true }, { name: 'alt', label: 'Descrição da capa', max: 300, advanced: true }, { name: 'articles', label: 'Artigos e blocos', type: 'blocks', fields: articleFields, max: 50 }];
export function validateDocument(_db: DB, p: ContentPayload) {
    const articles = p.articles as ContentPayload[];
    if (new Set(articles.map(a => a.id)).size !== articles.length)
        fail(422, 'Identificadores de artigos devem ser únicos.');
    for (const a of [p, ...articles])
        if (a.fileId && !a.alt)
            fail(422, 'Descreva as imagens para leitores de tela.');
}
const documentKinds = new Set(['newspapers']);
export function registerDocumentKind(kind: string) { documentKinds.add(kind); }
export async function documentSections(db: DB, v: Viewer, r: Row, p: ContentPayload) { return await mapAsync((p.articles as ContentPayload[]), async (a) => ({ id: a.id, title: a.title, text: [a.author, a.text].filter(Boolean).join('\n\n'), image: a.fileId ? `/api/journals/${r.id}/articles/${a.id}/image?stamp=${imageStamp(r)}` : null, alt: a.alt, links: a.npcId && await npcReference(db, v, String(a.npcId)) ? [{ label: (await npcReference(db, v, String(a.npcId)))!.name, href: '/portal/personagens/' + a.npcId }] : [] })); }
export async function notifyDocument(db: DB, r: Row, characters?: string[]) {
    for (const char of characters ?? (await all(db, 'SELECT id FROM characters')).map(c => String(c.id)))
        await enqueue(db, char, 'PUBLISHED_DOCUMENT', String(r.id), String(r.published_revision), 'SILENT');
}
registerContent('newspapers', { label: 'Profeta Diário', singular: 'Edição do Profeta Diário', global: true, retainArchive: true, fields: [...documentFields.map(f => f.name === 'title' ? { ...f, draftOptional: true } : f.name === 'academicYear' ? { ...f, required: false, advanced: true } : f), { name: 'number', label: 'Número da edição', required: true, draftOptional: true, max: 80 }, { name: 'narrativeDate', label: 'Data fictícia', max: 180 }, { name: 'headline', label: 'Manchete', required: true, draftOptional: true, max: 300 }, { name: 'subtitle', label: 'Subtítulo', max: 400 }, { name: 'authors', label: 'Editores e autores', max: 400 }, { name: 'notes', label: 'Notas e anúncios', type: 'richtext', max: 8000 }], validate: validateDocument, published: async (db, r) => await notifyDocument(db, r), project: async (db, v, r, p) => ({ title: p.title, description: p.description, meta: [p.number, p.narrativeDate, p.academicYear, p.authors].filter(Boolean), body: [p.headline, p.subtitle, p.notes].filter(Boolean).join('\n\n'), sections: await documentSections(db, v, r, p) }) });
registerEvent('PUBLISHED_DOCUMENT', async (db, v, e) => {
    const r = await one(db, 'SELECT * FROM content_records WHERE id=?', String(e.resource_id));
    if (!r || !documentKinds.has(String(r.kind)) || String(r.published_revision) !== e.fragment_id || !await contentAllowed(db, v, r))
        return null;
    return { title: String(contentPayload(r).title), text: 'Um novo registro está disponível.', href: '/portal/conteudos/' + r.kind + '/' + r.id };
});
export async function handleJournal(req: IncomingMessage, res: ServerResponse, url: URL, db: DB, config: Config, session?: Session): Promise<boolean> {
    const m = url.pathname.match(/^\/api\/(master\/)?journals\/([\w-]+)\/articles\/([\w-]+)\/image$/);
    if (!m)
        return false;
    const actor = requireSession(session), master = !!m[1];
    let v = await viewerFor(db, actor, url);
    if (master) {
        requireMaster(actor);
        if (v.preview)
            fail(403, 'Saia da prévia para administrar.');
        v = { ...v, role: 'PLAYER', characterId: url.searchParams.get('character'), preview: true };
    }
    const r = await one(db, 'SELECT * FROM content_records WHERE id=?', m[2]!) ?? fail(404, 'Imagem não encontrada.');
    if (req.method !== 'GET' || !documentKinds.has(String(r.kind)) || !await contentAllowed(db, v, r, master) || (!master && url.searchParams.get('stamp') !== imageStamp(r)) || (master && url.searchParams.get('version') !== String(r.version)))
        fail(404, 'Imagem não encontrada.');
    const a = (contentPayload(r, !master).articles as ContentPayload[]).find(a => a.id === m[3]);
    if (!a?.fileId)
        fail(404, 'Imagem não encontrada.');
    await renderImage(db, config, res, { fileId: String(a.fileId), crop: { x: 0, y: 0, width: 100, height: 100 } }, false);
    return true;
}
