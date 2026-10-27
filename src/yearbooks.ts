import { all, one, type DB } from './db.ts';
import { fail } from './auth.ts';
import { registerContent, registerReference, type Field, type ContentPayload } from './content.ts';
import { documentFields, validateDocument, documentSections, registerDocumentKind, notifyDocument } from './journal.ts';
registerReference('houseResults', async (db) => (await all(db, 'SELECT id,snapshot_json FROM house_results UNION ALL SELECT id,snapshot_json FROM cup_cycle_results')).map(r => { const s = JSON.parse(String(r.snapshot_json)); return { id: String(r.id), name: s.academicYearLabel + ' · resultado ' + s.revision }; }));
async function result(db: DB, p: ContentPayload) {
    if (!p.resultId)
        return null;
    const r = (await one(db, 'SELECT snapshot_json FROM house_results WHERE id=?', String(p.resultId)) ?? await one(db,'SELECT snapshot_json FROM cup_cycle_results WHERE id=?',String(p.resultId))) ?? fail(422, 'Resultado oficial não encontrado.');
    const s = JSON.parse(String(r.snapshot_json));
    if (!String(s.academicYear).startsWith('cycle-') && s.academicYear !== p.academicYear)
        fail(422, 'Escolha o resultado oficial do mesmo ano.');
    return s as {
        winnerHouseId: string;
        houses: {
            id: string;
            name: string;
            points: number;
            rank: number;
        }[];
    };
}
for (const kind of ['yearbooks', 'retrospectives']) {
    registerDocumentKind(kind);
    registerContent(kind, { label: kind === 'yearbooks' ? 'Anuários públicos' : 'Retrospectivas individuais', singular: kind === 'yearbooks' ? 'Anuário' : 'Retrospectiva individual', global: true, retainArchive: true, fields: [...documentFields.map(f => f.name === 'title' ? { ...f, label: kind === 'yearbooks' ? 'Título do anuário' : 'Título da retrospectiva' } : f), ...(kind === 'yearbooks' ? [{ name: 'resultId', label: 'Resultado oficial da Taça', type: 'reference', source: 'houseResults' }] as Field[] : [{ name: 'characterId', label: 'Dono da retrospectiva', type: 'reference', source: 'characters', required: true, draftOptional: true }] as Field[])], validate: async (db, p) => {
            validateDocument(db, p);
            if (kind === 'yearbooks')
                await result(db, p);
        }, allowed: (_db, v, _r, p) => kind === 'yearbooks' || v.characterId === p.characterId, published: async (db, r) => await notifyDocument(db, r, kind === 'retrospectives' ? [String(JSON.parse(String(r.published_json)).characterId)] : undefined), project: async (db, v, r, p) => { const s = kind === 'yearbooks' ? await result(db, p) : null; return { title: p.title, description: p.description, meta: [p.academicYear], sections: await documentSections(db, v, r, p), ...(s ? { body: 'Taça das Casas: ' + s.houses.find(h => h.id === s.winnerHouseId)?.name, table: { columns: ['Posição', 'Casa', 'Pontos'], rows: s.houses.map(h => [h.rank, h.name, h.points]) } } : {}) }; } });
}
