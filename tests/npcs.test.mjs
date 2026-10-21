import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createApplication } from '../dist/server.js';
import { fixture } from './helpers.mjs';
let f;
const base='/api/master/workshop/npcs',pub='/api/workshop/npcs';
const policy=(extra={})=>({audience:'SELECTED',characters:['atlas'],groups:[],houses:[],schoolYears:[],cohorts:[],excludedCharacters:[],regionId:null,locationId:null,...extra});
const payload=(extra={})=>({name:'Pessoa de teste',description:'Descrição autorizada',role:'MERCHANT',houseId:null,locationId:null,relatedLocations:[],portraitFileId:null,portraitAlt:'',...extra});
async function create(extra={},rules=policy()){const r=await f.master.request(base,{method:'POST',body:{payload:payload(extra),policy:rules,privateNotes:'SEGREDO PERMANENTE <script>teste</script>'}});assert.equal(r.status,201,JSON.stringify(r.value));return r.value;}
async function command(n,action,extra={}){const r=await f.master.request(`${base}/${n.id}/${action}`,{method:'POST',body:{version:n.version,...extra}});assert.equal(r.status,200,JSON.stringify(r.value));return r.value;}
async function edit(n,extra={},rules=n.policy){const previous={...n.payload};delete previous.fragments;const r=await f.master.request(`${base}/${n.id}`,{method:'PATCH',body:{version:n.version,payload:{...previous,...extra},policy:rules,privateNotes:n.privateNotes}});assert.equal(r.status,200,JSON.stringify(r.value));return r.value;}
async function fragment(n,extra={}){return command(n,'fragments',{fragmentId:null,title:'TITULO OCULTO',text:'TEXTO OCULTO',policy:policy({audience:'ALL'}),...extra});}
const get=(client,n)=>client.request(`${pub}/${n.id}`);
const tables=['npcs','npc_revisions','npc_reveals','npc_location_links','audit_log','sessions'];
const snapshot=()=>JSON.stringify(tables.map(t=>f.db.prepare(`SELECT * FROM ${t}`).all()));
before(async()=>{f=await fixture();});after(async()=>{await f?.close();});

test('migração NPC é aditiva, não cria conteúdo canônico nem altera os cinco protagonistas',()=>{
  assert.equal(f.db.prepare('SELECT count(*) n FROM npcs').get().n,0);
  assert.equal(f.db.prepare('SELECT count(*) n FROM characters').get().n,5);
  assert.equal(f.db.prepare('SELECT count(*) n FROM schema_migrations').get().n,6);
  assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
});
test('editores, referências, histórico e prévia exigem Mestre; mutações exigem CSRF e ator real',async()=>{
  const n=await create();
  for(const client of [f.atlas,f.client()])for(const path of [base,base+'/references',`${base}/${n.id}`,`${base}/${n.id}/history`,`${base}/${n.id}/preview?character=atlas`,`${base}/${n.id}/preview-portrait?character=atlas`])assert.equal((await client.request(path)).status,client===f.atlas?403:401);
  for(const suffix of ['', '/references',`/${n.id}/history`,`/${n.id}/preview?character=atlas`])assert.equal((await f.master.request(base+suffix+(suffix.includes('?')?'&':'?')+'view_as=atlas')).status,403);
  for(const action of ['publish','fragments','reveal','archive']){
    assert.equal((await f.master.request(`${base}/${n.id}/${action}`,{method:'POST',csrf:false,body:{version:n.version}})).status,403);
    assert.equal((await f.master.request(`${base}/${n.id}/${action}?view_as=atlas`,{method:'POST',body:{version:n.version}})).status,403);
  }
  assert.equal((await f.master.request(base,{method:'POST',origin:false,body:{}})).status,403);
  assert.equal((await f.client().request(pub)).status,401);
});
test('rascunho, preparado e cópia não aparecem por ID, busca, total ou referências públicas',async()=>{
  let n=await fragment(await create({name:'NAO CONHECIDO'}));
  n=await command(n,'prepare');const copy=await command(n,'duplicate');
  assert.equal(n.status,'PREPARED');assert.equal(copy.status,'DRAFT');assert.notEqual(copy.payload.fragments[0].id,n.payload.fragments[0].id);assert.deepEqual(copy.reveals,[]);
  for(const item of [n,copy])assert.equal((await get(f.atlas,item)).status,404);
  for(const path of [pub,pub+'/references']){const r=await f.atlas.request(path+'?q=NAO CONHECIDO');assert.equal(r.value.total,0);assert.ok(!JSON.stringify(r.value).includes(n.id));}
});
test('publicar perfil não revela fragmentos; busca, retrato e referências não expõem segredos',async()=>{
  const file=(await f.master.request('/api/master/workshop/files',{method:'POST',body:{asset:'hogwarts.webp'}})).value;
  let n=await fragment(await create({name:'PUBLICO RESTRITO',portraitFileId:file.id,portraitAlt:'Brasão de teste'}));n=await command(n,'publish');
  const own=await get(f.atlas,n);assert.equal(own.status,200);assert.deepEqual(own.value.fragments,[]);
  for(const secret of ['SEGREDO','OCULTO',n.payload.fragments[0].id,'policy','privateNotes','portraitFileId','version','reveals'])assert.ok(!JSON.stringify(own.value).includes(secret),secret);
  assert.equal((await f.atlas.request(own.value.portrait)).status,200);assert.equal((await f.eiris.request(own.value.portrait)).status,404);assert.equal((await f.client().request(own.value.portrait)).status,401);
  assert.equal((await f.atlas.request(file.image)).status,403);assert.equal((await f.atlas.request(`${pub}/${n.id}/portrait?stamp=wrong`)).status,404);
  for(const q of ['OCULTO','SEGREDO PERMANENTE'])assert.equal((await f.atlas.request(pub+'?q='+q)).value.total,0);
  for(const path of [pub,pub+'/references']){const r=await f.eiris.request(path+'?q=PUBLICO RESTRITO');assert.equal(r.value.total,0);assert.ok(!JSON.stringify(r.value).includes(n.id));}
  assert.equal((await get(f.eiris,n)).status,404);
});
test('rascunho de perfil, retrato e público preserva o snapshot até republicação',async()=>{
  const file=(await f.master.request('/api/master/workshop/files',{method:'POST',body:{asset:'hogwarts.webp'}})).value;
  let n=await command(await create({name:'PERFIL ANTERIOR',portraitFileId:file.id,portraitAlt:'Anterior'}),'publish');const old=(await get(f.atlas,n)).value;
  n=await edit(n,{name:'PERFIL NOVO',portraitFileId:null,portraitAlt:''},policy({characters:['eiris']}));
  assert.equal((await get(f.atlas,n)).value.name,'PERFIL ANTERIOR');assert.equal((await get(f.eiris,n)).status,404);assert.equal((await f.atlas.request(old.portrait)).status,200);
  const preview=await f.master.request(`${base}/${n.id}/preview?character=eiris&source=draft`);assert.equal(preview.value.npc.name,'PERFIL NOVO');assert.equal(preview.value.npc.portrait,null);
  n=await command(n,'publish');assert.equal((await f.atlas.request(old.portrait)).status,404);assert.equal((await get(f.atlas,n)).status,404);assert.equal((await get(f.eiris,n)).value.name,'PERFIL NOVO');assert.equal((await get(f.eiris,n)).value.portrait,null);
});
test('revelação é explícita e atômica, não duplica conhecimento e permite revogação',async()=>{
  let n=await command(await fragment(await create({name:'REVELACAO'})),'publish');const id=n.payload.fragments[0].id;
  const before=snapshot();const rejected=await f.master.request(`${base}/${n.id}/reveal`,{method:'POST',body:{version:n.version,fragmentId:id,characters:['atlas','eiris']}});assert.equal(rejected.status,422);assert.equal(snapshot(),before);
  n=await command(n,'reveal',{fragmentId:id,characters:['atlas']});assert.equal(n.hasUnpublishedChanges,false);
  assert.equal((await get(f.atlas,n)).value.fragments[0].text,'TEXTO OCULTO');
  n=await command(n,'reveal',{fragmentId:id,characters:['atlas']});assert.equal(f.db.prepare('SELECT count(*) n FROM npc_reveals WHERE npc_id=?').get(n.id).n,1);
  n=await command(n,'revoke',{fragmentId:id,characters:['atlas']});assert.deepEqual((await get(f.atlas,n)).value.fragments,[]);
  assert.equal((await f.atlas.request(pub+'?q=TEXTO%20OCULTO')).value.total,0);
  assert.equal(f.db.prepare('SELECT active FROM npc_reveals WHERE npc_id=?').get(n.id).active,0);
});
test('republicar texto não substitui conhecimento anterior sem uma nova revelação',async()=>{
  let n=await command(await fragment(await create()),'publish');const id=n.payload.fragments[0].id;n=await command(n,'reveal',{fragmentId:id,characters:['atlas']});
  n=await fragment(n,{fragmentId:id,title:'NOVO TITULO',text:'NOVO CONHECIMENTO'});assert.equal(n.hasUnpublishedChanges,true);
  assert.equal((await get(f.atlas,n)).value.fragments[0].text,'TEXTO OCULTO');n=await command(n,'publish');
  assert.equal((await get(f.atlas,n)).value.fragments[0].text,'TEXTO OCULTO');
  n=await command(n,'reveal',{fragmentId:id,characters:['atlas']});assert.equal((await get(f.atlas,n)).value.fragments[0].text,'NOVO CONHECIMENTO');
  n=await fragment(n,{fragmentId:id,policy:policy({audience:'ALL',excludedCharacters:['atlas']})});n=await command(n,'publish');assert.deepEqual((await get(f.atlas,n)).value.fragments,[]);
});
test('políticas de Casa/turma/grupo/ano e exclusões são aplicadas aos fragmentos no servidor',async()=>{
  await f.master.request('/api/master/characters/atlas',{method:'PATCH',body:{name:'Atlas Black',house:'gryffindor',year:1}});
  const cohort=(await f.master.request('/api/master/workshop/cohorts',{method:'POST',body:{name:'NPC turma',members:['atlas','eiris']}})).value;
  const group=(await f.master.request('/api/master/groups',{method:'POST',body:{name:'NPC grupo',members:['atlas','eiris']}})).value;
  let n=await create({},policy({audience:'ALL'}));n=await fragment(n,{policy:policy({characters:[],groups:[group.id],houses:['gryffindor'],schoolYears:[1],cohorts:[cohort.id]})});n=await command(n,'publish');
  const id=n.payload.fragments[0].id;n=await command(n,'reveal',{fragmentId:id,characters:['atlas']});assert.equal((await get(f.atlas,n)).value.fragments.length,1);
  await f.master.request(`/api/master/workshop/cohorts/${cohort.id}`,{method:'PATCH',body:{version:1,name:'NPC turma',members:['eiris']}});assert.deepEqual((await get(f.atlas,n)).value.fragments,[]);
  n=await edit(n,{},policy({audience:'ALL',excludedCharacters:['atlas']}));n=await command(n,'publish');assert.equal((await get(f.atlas,n)).status,404);
});
test('um NPC tem o mesmo ID em dois locais, sem revelar NPCs ou locais desconhecidos',async()=>{
  let n=await command(await create({name:'DUAS REFERENCIAS',locationId:'biblioteca',relatedLocations:['olivaras','biblioteca']}),'publish');
  assert.equal(f.db.prepare('SELECT count(*) n FROM npc_location_links WHERE npc_id=?').get(n.id).n,2);
  assert.deepEqual((await get(f.atlas,n)).value.locations.map(l=>l.id),['biblioteca']);
  assert.ok((await f.atlas.request('/api/locations/biblioteca')).value.contacts.some(v=>v.id===n.id));assert.ok(!(await f.eiris.request('/api/locations/biblioteca')).value.contacts.some(v=>v.id===n.id));
  assert.equal((await f.atlas.request(pub+'/references?locationId=olivaras')).status,404);
  await f.master.request('/api/master/regions/hogsmeade',{method:'PATCH',body:{isOpen:true,audience:'ALL',characters:[],groups:[]}});
  for(const id of ['biblioteca','olivaras'])assert.ok((await f.atlas.request(pub+'/references?locationId='+id)).value.items.some(v=>v.id===n.id));
  n=await edit(n,{name:'MESMO CADASTRO EDITADO'});assert.equal((await f.atlas.request(pub+'/references?locationId=biblioteca')).value.items.find(v=>v.id===n.id).name,'DUAS REFERENCIAS');n=await command(n,'publish');
  for(const id of ['biblioteca','olivaras'])assert.equal((await f.atlas.request(pub+'/references?locationId='+id)).value.items.find(v=>v.id===n.id).name,'MESMO CADASTRO EDITADO');
});
test('conflito de perfil/fragmento não perde dados; validação recusa IDs e campos inventados',async()=>{
  const initial=await create();let n=await edit(initial,{description:'Venceu'});
  const stale=await f.master.request(`${base}/${n.id}`,{method:'PATCH',body:{version:initial.version,payload:payload(),policy:policy(),privateNotes:''}});assert.equal(stale.status,409);
  assert.equal((await f.master.request(`${base}/${n.id}/fragments`,{method:'POST',body:{version:initial.version,fragmentId:null,title:'X',text:'X',policy:policy()}})).status,409);
  const before=snapshot();assert.equal((await f.master.request(`${base}/${n.id}/fragments`,{method:'POST',body:{version:n.version,fragmentId:'forjado',title:'X',text:'X',policy:policy()}})).status,404);assert.equal(snapshot(),before);
  for(const bad of [payload({portraitFileId:'forjado'}),payload({role:'MASTER'}),{...payload(),fragments:[]}])assert.equal((await f.master.request(base,{method:'POST',body:{payload:bad,policy:policy()}})).status,400);
  const history=(await f.master.request(`${base}/${n.id}/history`)).value.items;assert.equal(history.length,2);assert.equal(history[0].snapshot.payload.description,'Venceu');assert.equal(history[1].snapshot.payload.description,'Descrição autorizada');
  n=await edit(n,{portraitFileId:(await f.master.request('/api/master/workshop/files',{method:'POST',body:{asset:'hogwarts.webp'}})).value.id});assert.equal((await f.master.request(`${base}/${n.id}/publish`,{method:'POST',body:{version:n.version}})).status,422);
});
test('prévia de quatro Casas é leitura pura e a projeção publicada ignora alterações privadas',async()=>{
  const assignments={atlas:'gryffindor',eiris:'hufflepuff',jorge:'ravenclaw',keyleth:'slytherin'};
  const chars=f.db.prepare('SELECT id FROM characters').all().map(v=>v.id);let i=0;
  for(const id of chars.slice(0,4))await f.master.request('/api/master/characters/'+id,{method:'PATCH',body:{name:id,house:Object.values(assignments)[i++],year:1}});
  let n=await command(await fragment(await create()),'publish');n=await command(n,'reveal',{fragmentId:n.payload.fragments[0].id,characters:['atlas']});n=await edit(n,{name:'RASCUNHO PRIVADO'});
  const before=snapshot();for(const id of chars.slice(0,4))for(const source of ['draft','published']){
    const r=await f.master.request(`${base}/${n.id}/preview?character=${id}&source=${source}`);assert.equal(r.status,200);assert.equal(r.value.accessible,id==='atlas');assert.ok(!JSON.stringify(r.value).includes('SEGREDO PERMANENTE'));
    if(id==='atlas')assert.equal(r.value.npc.name,source==='draft'?'RASCUNHO PRIVADO':'Pessoa de teste');
  }
  assert.equal((await f.master.request(pub+`/${n.id}?view_as=atlas`)).value.name,'Pessoa de teste');assert.equal(snapshot(),before);
});
test('arquivar preserva histórico, referências e revelações; restaurar/cópia não publica',async()=>{
  let n=await command(await fragment(await create({locationId:'biblioteca'})),'publish');n=await command(n,'reveal',{fragmentId:n.payload.fragments[0].id,characters:['atlas']});n=await command(n,'archive');
  assert.equal((await get(f.atlas,n)).status,404);assert.equal(f.db.prepare('SELECT count(*) n FROM npc_location_links WHERE npc_id=?').get(n.id).n,1);assert.equal(f.db.prepare('SELECT active FROM npc_reveals WHERE npc_id=?').get(n.id).active,1);
  const copy=await command(n,'duplicate');assert.deepEqual(copy.reveals,[]);assert.equal(copy.status,'DRAFT');n=await command(n,'restore');assert.equal(n.status,'DRAFT');assert.equal((await get(f.atlas,n)).status,404);
  n=await command(n,'publish');assert.equal((await get(f.atlas,n)).value.fragments.length,1);assert.equal((await get(f.atlas,copy)).status,404);
  assert.equal((await f.master.request(`${base}/${n.id}/history`)).value.items.length,7);
});
test('backup restaurado mantém NPC, retrato privado, vínculos e conhecimentos autorizados',async()=>{
  const file=(await f.master.request('/api/master/workshop/files',{method:'POST',body:{asset:'hogwarts.webp'}})).value;
  let n=await command(await fragment(await create({portraitFileId:file.id,portraitAlt:'Teste',locationId:'biblioteca'})),'publish');n=await command(n,'reveal',{fragmentId:n.payload.fragments[0].id,characters:['atlas']});
  const directory=await mkdtemp(join(tmpdir(),'hogwarts-npcs-backup-'));await new Promise(resolve=>f.server.close(resolve));
  try{
    await promisify(execFile)(process.execPath,['--experimental-strip-types','src/cli.ts','backup',directory],{env:{...process.env,DATA_DIR:f.config.dataDir,APP_ORIGIN:f.config.origin,NODE_ENV:'test'}});
    const config={...f.config,dataDir:directory,port:0},restored=createApplication(config);await new Promise(resolve=>restored.server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${restored.server.address().port}`;config.origin=origin;
    try{const r=await fetch(origin+`${pub}/${n.id}`,{headers:{Cookie:f.atlas.cookie}});assert.equal(r.status,200);const dto=await r.json();assert.equal(dto.fragments[0].text,'TEXTO OCULTO');assert.equal((await fetch(origin+dto.portrait,{headers:{Cookie:f.atlas.cookie}})).status,200);assert.equal((await fetch(origin+`${pub}/${n.id}`,{headers:{Cookie:f.eiris.cookie}})).status,404);assert.equal(restored.db.prepare('SELECT count(*) n FROM npc_location_links WHERE npc_id=?').get(n.id).n,1);assert.deepEqual(restored.db.prepare('PRAGMA foreign_key_check').all(),[]);}
    finally{await new Promise(resolve=>restored.server.close(resolve));restored.db.close();}
  }finally{await rm(directory,{recursive:true,force:true});}
});
