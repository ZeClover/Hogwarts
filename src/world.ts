import { filterAsync, findAsync, mapAsync } from './async-array.ts';
import { readdirSync } from 'node:fs';
import { all, one, type DB } from './db.ts';
import { fail, type Viewer, type Session } from './auth.ts';
import { regionVisible, locationVisible, locationDTO } from './access.ts';
import { npcReference } from './npcs.ts';
import { policyAllows, imageStamp, type Policy } from './editorial.ts';
import { registerContent, registerReference, contentRecord, contentPayload, contentPolicy, contentAllowed, type Field, type ContentPayload } from './content.ts';
const defaultPolicy = { audience: 'ALL', characters: [], groups: [], houses: [], schoolYears: [], cohorts: [], excludedCharacters: [], regionId: null, locationId: null };
const assets = readdirSync('public/assets').filter(n => n.endsWith('.webp'));
for (const [name, table, column] of [['characters', 'characters', 'name'], ['houses', 'houses', 'name'], ['regions', 'regions', 'title'], ['places', 'locations', 'title'], ['npcs', 'npcs', 'draft_json'], ['items', 'catalog_items', 'draft_json'], ['files', 'workshop_files', 'id']] as const)
    registerReference(name, async (db) => (await all(db, `SELECT id,${column} AS value FROM ${table}`)).map(r => ({ id: String(r.id), name: column === 'draft_json' ? String(JSON.parse(String(r.value)).name) : String(r.value) })));
registerReference('assets', () => assets.map(id => ({ id, name: id.replaceAll('_', ' ').replace('.webp', '') })));
registerReference('shops', async (db) => (await all(db, "SELECT id,draft_json FROM content_records WHERE kind='shops'")).map(r => ({ id: String(r.id), name: String(JSON.parse(String(r.draft_json)).title) })));
const title: Field = { name: 'title', label: 'Nome', required: true, max: 120 }, description: Field = { name: 'description', label: 'Descrição pública', type: 'textarea', max: 4000 };
const imageFields: Field[] = [{ name: 'fileId', label: 'Imagem opcional', type: 'image', advanced: true }, { name: 'alt', label: 'Texto alternativo', max: 300, advanced: true }];
const nativePolicy = (_db: DB, _p: ContentPayload, policy: Policy) => {
    if (policy.regionId || policy.locationId)
        fail(422, 'Use o contexto do cadastro e deixe as restrições de região/local adicionais vazias.');
};
registerContent('regions', { label: 'Regiões', singular: 'Região', fields: [title, description, ...imageFields, { name: 'asset', label: 'Mapa de ambientação', type: 'reference', source: 'assets', advanced: true }], validate: nativePolicy,
    allowed: async (db, v, row) => { const native = await one(db, 'SELECT * FROM regions WHERE id=?', String(row.id)); return !!native && await regionVisible(db, v, native); }, project: (_db, _v, row, p) => ({ title: p.title, description: p.description, links: [{ label: 'Explorar região', href: '/portal/regiao/' + row.id }] }),
    published: async (db, row) => { const p = contentPayload(row); await db.prepare("INSERT INTO regions(id,title,audience,editorial_policy_json,file_id) VALUES(?,?,'ALL',?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,editorial_policy_json=excluded.editorial_policy_json,file_id=excluded.file_id").run(String(row.id), String(p.title), JSON.stringify(contentPolicy(row)), p.fileId as string | null); },
    archived: async (db, row) => { await db.prepare('UPDATE regions SET is_open=0 WHERE id=?').run(String(row.id)); } });
registerContent('places', { label: 'Locais e marcadores', singular: 'Local', fields: [title, description, { name: 'regionId', label: 'Região', type: 'reference', source: 'regions', required: true, draftOptional: true }, { name: 'kind', label: 'Tipo de local', type: 'select', options: ['SHOP', 'LIBRARY', 'ARCHIVE'], required: true }, { name: 'destination', label: 'Destino do marcador', type: 'select', options: ['LOCATION', 'CATALOG', 'LIBRARY', 'BOARD'], required: true }, { name: 'asset', label: 'Imagem de ambientação', type: 'reference', source: 'assets', advanced: true }, ...imageFields, { name: 'isSecret', label: 'Local secreto', type: 'checkbox', advanced: true }, { name: 'x', label: 'Marcador horizontal (%)', type: 'number', max: 100, advanced: true }, { name: 'y', label: 'Marcador vertical (%)', type: 'number', max: 100, advanced: true }], validate: nativePolicy,
    allowed: async (db, v, row) => { const native = await one(db, 'SELECT * FROM locations WHERE id=?', String(row.id)); return !!native && await locationVisible(db, v, native); }, project: (_db, _v, row, p) => ({ title: p.title, description: p.description, links: [{ label: 'Abrir local', href: '/portal/local/' + row.id }] }),
    published: async (db, row) => { const p = contentPayload(row); await db.prepare("INSERT INTO locations(id,region_id,title,image,kind,is_secret,audience,x,y,editorial_policy_json,file_id,destination) VALUES(?,?,?,?,?,?,'ALL',?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET region_id=excluded.region_id,title=excluded.title,image=excluded.image,kind=excluded.kind,is_secret=excluded.is_secret,x=excluded.x,y=excluded.y,editorial_policy_json=excluded.editorial_policy_json,file_id=excluded.file_id,destination=excluded.destination").run(String(row.id), String(p.regionId), String(p.title), String(p.asset ?? ''), String(p.kind), Number(p.isSecret), p.x as number | null, p.y as number | null, JSON.stringify(contentPolicy(row)), p.fileId as string | null, String(p.destination)); },
    archived: async (db, row) => { await db.prepare('UPDATE locations SET enabled=0 WHERE id=?').run(String(row.id)); } });
export async function publicItem(db: DB, v: Viewer, id: string) {
    const row = await one(db, "SELECT * FROM catalog_items WHERE id=? AND status='PUBLISHED'", id);
    if (!row || !await policyAllows(db, v, JSON.parse(String(row.published_policy_json)) as Policy))
        return null;
    const p = JSON.parse(String(row.published_json)) as {
        name: string;
        description: string;
        fileId: string | null;
        alt: string;
    };
    return { id: row.id, title: p.name, description: p.description, image: p.fileId ? '/api/workshop/items/' + id + '/image?stamp=' + imageStamp(row) : null, alt: p.alt };
}
export async function publicShop(db: DB, v: Viewer, id: string) { const shop = await one(db, "SELECT * FROM content_records WHERE kind='shops' AND id=?", id); return shop && await contentAllowed(db, v, shop) ? shop : null; }
registerContent('shops', { label: 'Lojas e estabelecimentos', singular: 'Loja', fields: [title, description, { name: 'locationId', label: 'Local', type: 'reference', source: 'places', required: true, draftOptional: true }, { name: 'npcId', label: 'Comerciante', type: 'reference', source: 'npcs' }, ...imageFields, { name: 'hasCatalog', label: 'Possui catálogo', type: 'checkbox' }, { name: 'available', label: 'Estabelecimento disponível', type: 'checkbox' }],
    allowed: async (db, v, _row, p) => { const local = await one(db, 'SELECT * FROM locations WHERE id=?', p.locationId as string); return !!p.available && !!local && await locationVisible(db, v, local); },
    project: async (db, v, row, p) => { const npc = p.npcId ? await npcReference(db, v, String(p.npcId)) : null; return { title: p.title, description: p.description, npc, hasCatalog: p.hasCatalog, locationId: p.locationId, links: p.hasCatalog ? [{ label: 'Ver catálogo', href: '/portal/catalogo/' + row.id }] : [] }; } });
registerContent('offers', { label: 'Ofertas dos catálogos', singular: 'Oferta', fields: [title, { name: 'itemId', label: 'Item do catálogo', type: 'reference', source: 'items', required: true, draftOptional: true }, { name: 'shopId', label: 'Estabelecimento', type: 'reference', source: 'shops', required: true, draftOptional: true }, { name: 'available', label: 'Oferta disponível', type: 'checkbox' }, { name: 'priceNuques', label: 'Preço privado da oferta (Nuques)', type: 'number', required: true, draftOptional: true }, { name: 'stock', label: 'Estoque opcional (vazio = ilimitado)', type: 'number', advanced: true }, { name: 'conditions', label: 'Condições internas', type: 'textarea', advanced: true, max: 2000 }],
    allowed: async (db, v, _row, p) => { const shop = await publicShop(db, v, String(p.shopId)); return !!p.available && !!shop && !!contentPayload(shop).hasCatalog && !!await publicItem(db, v, String(p.itemId)); },
    project: async (db, v, row, p) => { const item = (await publicItem(db, v, String(p.itemId)))!; return { title: item.title, description: item.description, image: item.image, alt: item.alt, itemId: item.id, shopId: p.shopId, copyText: [item.title, item.description].join('\n\n'), requestHref: '/portal/pedido/' + row.id }; },
    published: async (db, row, before) => {
        const p = contentPayload(row), item = await one(db, "SELECT id FROM catalog_items WHERE id=? AND status='PUBLISHED'", String(p.itemId));
        if (!item)
            fail(422, 'Publique o item antes da oferta.');
        await contentRecord(db, 'shops', String(p.shopId));
        if (!before.published_json || contentPayload(before).stock !== p.stock)
            await db.prepare('INSERT INTO offer_stock(offer_id,remaining) VALUES(?,?) ON CONFLICT(offer_id) DO UPDATE SET remaining=excluded.remaining').run(String(row.id), p.stock as number | null);
    } });
export async function mirrorLocation(db: DB, id: string, actor: Session) {
    const row = (await one(db, 'SELECT * FROM locations WHERE id=?', id))!;
    if (await one(db, 'SELECT id FROM content_records WHERE id=?', id))
        return;
    const p = { title: row.title, description: '', regionId: row.region_id, kind: row.kind, fileId: null, alt: '', asset: row.image, isSecret: !!row.is_secret, x: row.x, y: row.y, destination: 'LOCATION' };
    await db.prepare("INSERT INTO content_records(id,kind,owner_user_id,status,draft_json,draft_policy_json,published_json,published_policy_json,published_revision) VALUES(?,'places',?,'PUBLISHED',?,?,?,?,1)").run(id, actor.userId, JSON.stringify(p), JSON.stringify(defaultPolicy), JSON.stringify(p), JSON.stringify(defaultPolicy));
}
export async function regionMap(db: DB, v: Viewer, id: string) {
    const native = await one(db, 'SELECT * FROM regions WHERE id=?', id);
    if (!native || !await regionVisible(db, v, native))
        fail(404, 'Região não encontrada.');
    const row = await one(db, "SELECT * FROM content_records WHERE id=? AND kind='regions'", id);
    const locations = await filterAsync(await all(db, 'SELECT * FROM locations WHERE region_id=?', id), r => locationVisible(db, v, r));
    return { id: native.id, title: native.title, image: native.file_id ? '/api/content/regions/' + id + '/image' : row?.published_json ? contentPayload(row).asset ? '/assets/' + String(contentPayload(row).asset) : null : '/assets/hogsmeade_mapa_limpo.webp', locations: await mapAsync(locations, async r => {
        const shops = r.kind === 'SHOP' || r.destination === 'CATALOG' ? await locationShops(db, v, String(r.id)) : [];
        const board = r.destination === 'BOARD' ? await locationBoardId(db, v, String(r.id)) : null;
        const href = board ? '/portal/conteudos/boards/' + board : shops.length === 1 || r.destination === 'CATALOG' && shops.length ? '/portal/catalogo/' + shops[0]!.id : '/portal/local/' + r.id;
        return { ...locationDTO(r), destination: r.destination, href };
    }) };
}
export async function locationShops(db: DB, v: Viewer, id: string) { return (await filterAsync((await all(db, "SELECT * FROM content_records WHERE kind='shops'")), async (r) => await contentAllowed(db, v, r) && contentPayload(r).locationId === id)).map(r => ({ id: r.id, title: contentPayload(r).title })); }
async function locationBoardId(db: DB, v: Viewer, id: string) { const board = await findAsync((await all(db, "SELECT * FROM content_records WHERE kind='boards'")), async (r) => r.published_json && contentPayload(r).locationId === id && await contentAllowed(db, v, r)); return board?.id ?? null; }
