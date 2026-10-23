import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {fixture} from './helpers.mjs';
test('inventário público exato preserva bytes V4 e transparência da moldura aprovada',async()=>{
 const manifest=JSON.parse(await readFile('docs/V5-MIDIAS-PUBLICAS.json','utf8')),all={...manifest.preservedV4,...manifest.addedV5};assert.equal(Object.keys(manifest.addedV5).length,14);assert.deepEqual((await readdir('public/assets')).sort(),Object.keys(all).sort());
 for(const [name,hash] of Object.entries(all))assert.equal(createHash('sha256').update(await readFile('public/assets/'+name)).digest('hex'),hash,name);
 const frame=await sharp('public/assets/moldura_sapos_frente_transparente.webp').metadata();assert.ok(frame.hasAlpha);assert.equal(frame.width,990);assert.equal(frame.height,905);
});
test('Mestre reutiliza arte pública V5; arquivos fora do inventário não são servidos ou importados',async()=>{
 const f=await fixture();try{
  const context=(await f.master.request('/api/master/workshop/context')).value;assert.ok(context.approvedAssets.includes('loja_gladrags.webp'));
  const before=f.db.prepare('SELECT count(*) n FROM locations').get().n;const r=await f.master.request('/api/master/workshop/files',{method:'POST',body:{asset:'loja_gladrags.webp'}});assert.equal(r.status,201);assert.equal((await f.atlas.request('/api/master/workshop/files/'+r.value.id)).status,403);assert.equal(f.db.prepare('SELECT count(*) n FROM locations').get().n,before);
  for(const path of ['/assets/referencia_privada.webp','/03_PRIVADO_DO_MESTRE_NAO_PUBLICAR/referencia.webp'])assert.equal((await f.client().request(path)).status,404);
  assert.equal((await f.master.request('/api/master/workshop/files',{method:'POST',body:{asset:'../referencia_privada.webp'}})).status,400);
 }finally{await f.close();}
});
