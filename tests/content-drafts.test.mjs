import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,commercialFixture} from './helpers.mjs';
import {contentDraftDefaults} from '../public/quick-create.js';
const policy={audience:'ALL',characters:[],groups:[],houses:[],schoolYears:[],cohorts:[],excludedCharacters:[],regionId:null,locationId:null};
const root=kind=>'/api/master/content/'+kind;
async function body(f,kind,title){const context=(await f.master.request('/api/master/content/context')).value;const year=(await f.master.request('/api/state')).value.calendar.academicYear;return {payload:{...contentDraftDefaults(kind,context.schemas[kind].fields,year),title},policy,privateNotes:''};}

test('livro, aula, loja, oferta, região e local persistem só com título, sem exposição ou estoque',async()=>{
 const f=await fixture();
 try{
  for(const kind of ['books','lessons','shops','offers','regions','places']){
   const input=await body(f,kind,'RASCUNHO PRIVADO '+kind),r=await f.master.request(root(kind),{method:'POST',body:input});
   assert.equal(r.status,201,JSON.stringify(r.value));assert.equal(r.value.status,'DRAFT');
   assert.equal((await f.master.request(root(kind)+'/'+r.value.id)).value.payload.title,input.payload.title);
   assert.equal((await f.atlas.request('/api/content/'+kind+'/'+r.value.id)).status,404);
   assert.ok(!(await f.atlas.request('/api/content/'+kind)).value.items.some(p=>p.id===r.value.id));
   assert.equal((await f.atlas.request(root(kind),{method:'POST',body:input})).status,403);
   if(kind==='books')assert.equal(r.value.payload.category,'NORMAL');
   if(kind==='lessons')assert.equal(r.value.payload.academicYear,(await f.master.request('/api/state')).value.calendar.academicYear);
   if(['shops','offers','places'].includes(kind)){
    const before=f.db.prepare('SELECT * FROM content_records WHERE id=?').get(r.value.id);
    for(const action of ['prepare','publish'])assert.equal((await f.master.request(root(kind)+'/'+r.value.id+'/'+action,{method:'POST',body:{version:r.value.version}})).status,422);
    assert.deepEqual(f.db.prepare('SELECT * FROM content_records WHERE id=?').get(r.value.id),before);
   }
  }
  assert.equal(f.db.prepare('SELECT count(*) n FROM offer_stock').get().n,0);
  assert.equal(f.db.prepare('SELECT count(*) n FROM workshop_files').get().n,0);
  assert.equal(f.db.prepare('SELECT count(*) n FROM regions').get().n,2);
  assert.equal(f.db.prepare('SELECT count(*) n FROM locations').get().n,5);
 }finally{await f.close();}
});

test('oferta incompleta nunca publica; referência inválida é recusada e preço ausente preserva publicação antiga',async()=>{
 const f=await fixture();
 try{
  const {item,shop}=await commercialFixture(f),input=await body(f,'offers','OFERTA EM PREPARAÇÃO');
  input.payload.itemId=item.id;input.payload.shopId=shop.id;input.payload.available=true;
  let r=await f.master.request(root('offers'),{method:'POST',body:input});assert.equal(r.status,201);let offer=r.value;
  assert.equal(offer.payload.priceNuques,null);
  assert.equal((await f.master.request(root('offers')+'/'+offer.id+'/publish',{method:'POST',body:{version:offer.version}})).status,422);
  assert.equal(f.db.prepare('SELECT * FROM offer_stock WHERE offer_id=?').get(offer.id),undefined);
  const invalid=await body(f,'shops','REF INVÁLIDA');invalid.payload.locationId='inexistente';
  assert.equal((await f.master.request(root('shops'),{method:'POST',body:invalid})).status,400);
  const edited={...input,payload:{...input.payload,priceNuques:493,stock:3}};
  offer=(await f.master.request(root('offers')+'/'+offer.id,{method:'PATCH',body:{...edited,version:offer.version}})).value;
  r=await f.master.request(root('offers')+'/'+offer.id+'/publish',{method:'POST',body:{version:offer.version}});assert.equal(r.status,200);offer=r.value;
  const published=f.db.prepare('SELECT published_json FROM content_records WHERE id=?').get(offer.id).published_json;
  const publicRecord=(await f.atlas.request('/api/content/offers/'+offer.id)).value;
  for(const field of ['priceNuques','stock','conditions'])assert.ok(!(field in publicRecord));
  offer=(await f.master.request(root('offers')+'/'+offer.id,{method:'PATCH',body:{...input,version:offer.version}})).value;
  assert.equal((await f.master.request(root('offers')+'/'+offer.id+'/publish',{method:'POST',body:{version:offer.version}})).status,422);
  assert.equal(f.db.prepare('SELECT published_json FROM content_records WHERE id=?').get(offer.id).published_json,published);
  assert.equal(f.db.prepare('SELECT remaining FROM offer_stock WHERE offer_id=?').get(offer.id).remaining,3);
  assert.equal((await f.atlas.request('/api/content/offers/'+offer.id)).status,200);
 }finally{await f.close();}
});

test('publicar obra preserva o modelo congelado mesmo após arquivar o modelo original',async()=>{
 const f=await fixture();
 try{
  const template=await body(f,'templates','MODELO DA FIXTURE');template.payload.family='BOOK';template.payload.heading='Cabeçalho congelado';
  let model=(await f.master.request(root('templates'),{method:'POST',body:template})).value;
  model=(await f.master.request(root('templates')+'/'+model.id+'/publish',{method:'POST',body:{version:model.version}})).value;
  const input=await body(f,'books','OBRA DA FIXTURE');input.payload.templateId=model.id;
  const created=await f.master.request(root('books'),{method:'POST',body:input});assert.equal(created.status,201);const book=created.value;
  assert.equal((await f.master.request(root('templates')+'/'+model.id+'/archive',{method:'POST',body:{version:model.version}})).status,200);
  const publication=await f.master.request(root('books')+'/'+book.id+'/publish',{method:'POST',body:{version:book.version}});
  assert.equal(publication.status,200,JSON.stringify(publication.value));
  assert.equal((await f.atlas.request('/api/content/books/'+book.id)).value.template.heading,'Cabeçalho congelado');
 }finally{await f.close();}
});

test('região e local funcionam sem fotografia e novo marcador só aparece após liberação individual',async()=>{
 const f=await fixture();
 try{
  const input=await body(f,'regions','REGIÃO SEM MAPA');let region=(await f.master.request(root('regions'),{method:'POST',body:input})).value;
  let published=await f.master.request(root('regions')+'/'+region.id+'/publish',{method:'POST',body:{version:region.version}});assert.equal(published.status,200);region=published.value;
  assert.equal((await f.atlas.request('/api/world/regions/'+region.id)).status,404);
  await f.master.request('/api/master/regions/'+region.id,{method:'PATCH',body:{isOpen:true,audience:'ALL',characters:[],groups:[]}});
  assert.equal((await f.atlas.request('/api/world/regions/'+region.id)).value.image,null);
  const marker=await body(f,'places','LOCAL SEM FOTO');marker.payload.regionId=region.id;let place=(await f.master.request(root('places'),{method:'POST',body:marker})).value;
  published=await f.master.request(root('places')+'/'+place.id+'/publish',{method:'POST',body:{version:place.version}});assert.equal(published.status,200);place=published.value;
  assert.equal((await f.atlas.request('/api/locations/'+place.id)).status,404);
  assert.ok(!(await f.atlas.request('/api/world/regions/'+region.id)).value.locations.some(l=>l.id===place.id));
  assert.equal((await f.master.request('/api/master/locations/'+place.id,{method:'PATCH',body:{enabled:true,isSecret:true,audience:'ALL',characters:['atlas'],groups:[],x:null,y:null}})).status,200);
  assert.equal((await f.atlas.request('/api/locations/'+place.id)).value.image,null);
  assert.equal((await f.eiris.request('/api/locations/'+place.id)).status,404);
 }finally{await f.close();}
});
