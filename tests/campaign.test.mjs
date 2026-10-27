import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createApplication } from '../dist/server.js';
import { openDatabase } from '../dist/db.js';
import { fixture } from './helpers.mjs';
let f,file;
const base='/api/master/campaign',pub='/api/campaign';
const policy=(extra={})=>({audience:'SELECTED',characters:['atlas'],groups:[],houses:[],schoolYears:[],cohorts:[],excludedCharacters:[],regionId:null,locationId:null,...extra});
const payload=(extra={})=>({title:'NARRATIVA DE TESTE',summary:'Resumo autorizado',kind:'Side-quest',academicYear:'1890–1891',fileId:null,alt:'',npcId:null,locationId:null,hook:'Gancho público',...extra});
const internal=()=>({synopsis:'SINOPSE SECRETA <script>teste</script>',importance:'IMPORTANCIA PRIVADA',releaseConditions:'CONDICAO PRIVADA',notes:'NOTAS PRIVADAS'});
const entryPayload=(extra={})=>({kind:'CHAPTER',title:'CAPITULO OCULTO',text:'TEXTO OCULTO',npcId:null,locationId:null,fileId:null,alt:'',...extra});
async function create(domain='quests',extra={},rules=policy(),protagonist='atlas'){
  const r=await f.master.request(`${base}/${domain}`,{method:'POST',body:{payload:payload(extra),policy:rules,private:internal(),...(domain==='stories'?{protagonistId:protagonist}:{})}});assert.equal(r.status,201,JSON.stringify(r.value));return r.value;
}
async function cmd(domain,n,action,extra={}){const r=await f.master.request(`${base}/${domain}/${n.id}/${action}`,{method:'POST',body:{version:n.version,...extra}});assert.equal(r.status,200,JSON.stringify(r.value));return r.value;}
async function edit(domain,n,extra={},rules=n.policy,protagonist=n.protagonistId){const r=await f.master.request(`${base}/${domain}/${n.id}`,{method:'PATCH',body:{version:n.version,payload:{...n.payload,...extra},policy:rules,private:n.private,...(domain==='stories'?{protagonistId:protagonist}:{})}});assert.equal(r.status,200,JSON.stringify(r.value));return r.value;}
async function entry(n,extra={},entryId=null){return cmd('stories',n,'entries',{entryId,payload:entryPayload(extra),privateNotes:'NOTA DA ENTRADA SECRETA'});}
const read=(client,domain,n)=>client.request(`${pub}/${domain}/${n.id}`);
const snapshot=()=>JSON.stringify(['quests','quest_participants','quest_revisions','personal_story_arcs','personal_story_entries','personal_story_reveals','story_revisions','audit_log','sessions'].map(t=>f.db.prepare(`SELECT * FROM ${t}`).all()));
before(async()=>{f=await fixture();file=(await f.master.request('/api/master/workshop/files',{method:'POST',body:{asset:'hogwarts.webp'}})).value;});after(async()=>{await f?.close();});

test('migração aditiva F2.2a preserva itens, NPCs e protagonistas, sem semear narrativas',async()=>{
  for(const table of ['quests','personal_story_arcs','personal_story_entries'])assert.equal(f.db.prepare(`SELECT count(*) n FROM ${table}`).get().n,0);
  const directory=await mkdtemp(join(tmpdir(),'hogwarts-narrative-migration-'));
  try{
    const migrations=join(directory,'migrations');await mkdir(migrations);for(const name of ['001_foundation.sql','002_workshop_media.sql','003_npc_workshop.sql','004_item_workshop.sql'])await cp('migrations/'+name,join(migrations,name));
    const config={...f.config,dataDir:join(directory,'data'),migrationsDir:migrations},db=openDatabase(config);
    db.exec("INSERT INTO users(id,email,password_hash,role) VALUES('master','migration@test.invalid','test','MASTER'); INSERT INTO catalog_items(id,owner_user_id,draft_json,draft_policy_json,private_json) VALUES('item','master','{\"name\":\"Preservado\"}','{}','{\"chosenPriceNuques\":493}'); INSERT INTO npcs(id,owner_user_id,draft_json,draft_policy_json,private_notes) VALUES('npc','master','{}','{}','SEGREDO'); UPDATE characters SET biography='Preservada' WHERE id='atlas'");
    const old=JSON.stringify(['characters','catalog_items','npcs'].map(t=>db.prepare(`SELECT * FROM ${t}`).all()));db.close();const migrated=openDatabase({...config,migrationsDir:resolve('migrations')});assert.equal(JSON.stringify(['characters','catalog_items','npcs'].map(t=>migrated.prepare(`SELECT * FROM ${t}`).all())),old);assert.deepEqual(migrated.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(migrated.prepare('SELECT count(*) n FROM quests').get().n,0);migrated.close();
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('autoria, participantes, prévia, capítulos, histórico e contexto exigem Mestre real',async()=>{
  const quest=await create(),story=await create('stories');
  for(const client of [f.atlas,f.client()])for(const path of [base+'/context',base+'/quests',base+'/stories',`${base}/quests/${quest.id}`,`${base}/stories/${story.id}/history`,`${base}/stories/${story.id}/preview?character=atlas`,`${base}/quests/${quest.id}/preview-image?character=atlas`])assert.equal((await client.request(path)).status,client===f.atlas?403:401,path);
  for(const action of ['publish','release','start','archive','revoke'])for(const options of [{client:f.atlas},{client:f.master,csrf:false},{client:f.master,view:true}])assert.equal((await options.client.request(`${base}/quests/${quest.id}/${action}`+(options.view?'?view_as=atlas':''),{method:'POST',body:{version:1,characters:['atlas']},csrf:options.csrf??true})).status,403);
  assert.equal((await f.master.request(base+'/context?view_as=atlas')).status,403);assert.equal((await f.master.request(base+'/stories',{method:'POST',origin:false,body:{}})).status,403);assert.equal((await f.client().request(pub+'/quests')).status,401);
});
test('salvar, preparar e duplicar não publicam anúncio, iniciam missão ou liberam Diário',async()=>{
  let n=await create('quests',{title:'SEGREDO NAO PUBLICADO'});n=await cmd('quests',n,'prepare');const copy=await cmd('quests',n,'duplicate');assert.equal(copy.status,'DRAFT');assert.deepEqual(copy.participants,[]);
  for(const item of [n,copy])for(const domain of ['quests','announcements'])assert.equal((await read(f.atlas,domain,item)).status,404);
  assert.equal((await f.atlas.request(pub+'/quests?q=SEGREDO NAO PUBLICADO')).value.total,0);assert.equal((await f.atlas.request(pub+'/announcements?q=SEGREDO NAO PUBLICADO')).value.total,0);
});
test('anúncio publicado é referência autorizada, sem aceite, participantes, segredos ou progresso',async()=>{
  const n=await cmd('quests',await create('quests',{title:'ANUNCIO PUBLICADO',fileId:file.id,alt:'Teste'}),'publish');const before=snapshot();
  const announcement=await read(f.atlas,'announcements',n);assert.equal(announcement.status,200);assert.equal((await f.atlas.request(announcement.value.image)).status,200);
  for(const hidden of ['SINOPSE','IMPORTANCIA','CONDICAO','NOTAS','participants','state','policy','fileId','version','atlas'])assert.ok(!JSON.stringify(announcement.value).includes(hidden),hidden);
  assert.equal((await read(f.eiris,'announcements',n)).status,404);assert.equal((await read(f.atlas,'quests',n)).status,404);assert.equal(f.db.prepare('SELECT count(*) n FROM quest_participants WHERE quest_id=?').get(n.id).n,0);assert.equal(snapshot(),before);
});
test('liberação em lote valida todos antes de gravar e não inicia missão automaticamente',async()=>{
  let n=await cmd('quests',await create(),'publish');const before=snapshot();assert.equal((await f.master.request(`${base}/quests/${n.id}/release`,{method:'POST',body:{version:n.version,characters:['atlas','eiris']}})).status,422);assert.equal(snapshot(),before);
  n=await cmd('quests',n,'release',{characters:['atlas']});assert.equal((await read(f.atlas,'quests',n)).value.state,'AVAILABLE');assert.equal((await read(f.eiris,'quests',n)).status,404);assert.equal(n.hasUnpublishedChanges,false);
});
test('início é manual por participante; novos participantes não herdam andamento',async()=>{
  let n=await cmd('quests',await create('quests',{},policy({audience:'ALL'})),'publish');n=await cmd('quests',n,'release',{characters:['atlas']});n=await cmd('quests',n,'start',{characters:['atlas']});assert.equal((await read(f.atlas,'quests',n)).value.state,'IN_PROGRESS');
  n=await cmd('quests',n,'release',{characters:['atlas','eiris']});assert.equal((await read(f.atlas,'quests',n)).value.state,'IN_PROGRESS');assert.equal((await read(f.eiris,'quests',n)).value.state,'AVAILABLE');
  const before=snapshot();assert.equal((await f.master.request(`${base}/quests/${n.id}/start`,{method:'POST',body:{version:n.version,characters:['atlas','eiris']}})).status,409);assert.equal(snapshot(),before);
  const own=(await read(f.atlas,'quests',n)).value;assert.ok(!JSON.stringify(own).includes('eiris'));assert.ok(!JSON.stringify(own).includes('participants'));
});
test('revogar tira Diário/imagem imediatamente e nova liberação não reinicia por conta própria',async()=>{
  let n=await cmd('quests',await create('quests',{fileId:file.id,alt:'Teste'}),'publish');n=await cmd('quests',n,'release',{characters:['atlas']});n=await cmd('quests',n,'start',{characters:['atlas']});const image=(await read(f.atlas,'quests',n)).value.image;
  n=await cmd('quests',n,'revoke',{characters:['atlas']});assert.equal((await read(f.atlas,'quests',n)).status,404);assert.equal((await f.atlas.request(image)).status,404);assert.equal((await read(f.atlas,'announcements',n)).status,200);
  n=await cmd('quests',n,'release',{characters:['atlas']});assert.equal((await read(f.atlas,'quests',n)).value.state,'AVAILABLE');
});
test('arquivar preserva leitura adquirida, retira anúncio e restauração não dá novo acesso',async()=>{
  let n=await cmd('quests',await create('quests',{fileId:file.id,alt:'Teste'},policy({audience:'ALL'})),'publish');n=await cmd('quests',n,'release',{characters:['atlas']});n=await cmd('quests',n,'start',{characters:['atlas']});n=await cmd('quests',n,'archive');const record=(await read(f.atlas,'quests',n)).value;
  assert.equal(record.archived,true);assert.equal(record.state,'IN_PROGRESS');assert.equal((await f.atlas.request(record.image)).status,200);assert.equal((await read(f.atlas,'announcements',n)).status,404);assert.equal((await read(f.eiris,'quests',n)).status,404);
  n=await cmd('quests',n,'restore');assert.equal(n.status,'DRAFT');assert.equal((await read(f.atlas,'quests',n)).value.archived,true);assert.equal((await read(f.eiris,'quests',n)).status,404);assert.equal((await read(f.atlas,'announcements',n)).status,404);
});
test('NPC/local vinculados usam IDs reais sem revelar referência ainda desconhecida',async()=>{
  const npc=(await f.master.request('/api/master/workshop/npcs',{method:'POST',body:{payload:{name:'NPC SECRETO',description:'Descrição',role:'PROFESSOR',houseId:null,locationId:null,relatedLocations:[],portraitFileId:null,portraitAlt:''},policy:policy(),privateNotes:'SEGREDO NPC'}})).value;
  let n=await cmd('quests',await create('quests',{npcId:npc.id,locationId:'olivaras'}),'publish');n=await cmd('quests',n,'release',{characters:['atlas']});let dto=(await read(f.atlas,'quests',n)).value;assert.equal(dto.npc,null);assert.equal(dto.location,null);assert.ok(!JSON.stringify(dto).includes(npc.id));assert.ok(!JSON.stringify(dto).includes('olivaras'));
  await f.master.request(`/api/master/workshop/npcs/${npc.id}/publish`,{method:'POST',body:{version:npc.version}});dto=(await read(f.atlas,'quests',n)).value;assert.equal(dto.npc.id,npc.id);assert.equal(dto.npc.name,'NPC SECRETO');
});
test('editar rascunho não altera anúncio/Diário publicado nem imagem até republicação',async()=>{
  let n=await cmd('quests',await create('quests',{title:'VERSAO ANTERIOR',fileId:file.id,alt:'Teste'}),'publish');n=await cmd('quests',n,'release',{characters:['atlas']});const old=(await read(f.atlas,'quests',n)).value;
  n=await edit('quests',n,{title:'NOVA REVISAO'},policy({characters:['eiris']}));assert.equal((await read(f.atlas,'quests',n)).value.title,'VERSAO ANTERIOR');assert.equal((await f.atlas.request(old.image)).status,200);assert.equal((await read(f.eiris,'announcements',n)).status,404);
  n=await cmd('quests',n,'publish');assert.equal((await read(f.atlas,'quests',n)).status,404);assert.equal((await f.atlas.request(old.image)).status,404);assert.equal((await read(f.eiris,'announcements',n)).value.title,'NOVA REVISAO');assert.equal((await read(f.eiris,'quests',n)).status,404);
});
test('histórias têm domínio e protagonista próprios, sem publicação no mural ou Diário de missões',async()=>{
  let n=await entry(await create('stories',{title:'ARCO PESSOAL OCULTO'}));n=await cmd('stories',n,'publish');
  for(const client of [f.atlas,f.eiris])assert.equal((await read(client,'stories',n)).status,404);assert.equal((await f.atlas.request(pub+'/quests?q=ARCO PESSOAL OCULTO')).value.total,0);assert.equal((await f.atlas.request(pub+'/announcements?q=ARCO PESSOAL OCULTO')).value.total,0);
  n=await cmd('stories',n,'release');assert.equal((await read(f.atlas,'stories',n)).status,200);assert.equal((await read(f.eiris,'stories',n)).status,404);assert.equal((await f.eiris.request(pub+'/stories?q=ARCO PESSOAL OCULTO')).value.total,0);
});
test('capítulos/eventos/revelações só aparecem após comando; sem nomes, IDs ou contagem oculta',async()=>{
  let n=await entry(await create('stories',{title:'ARCO REVELAVEL'}));n=await entry(n,{kind:'EVENT',title:'EVENTO OCULTO'});n=await cmd('stories',n,'publish');n=await cmd('stories',n,'release');const id=n.entries[0].id;
  let dto=(await read(f.atlas,'stories',n)).value;assert.deepEqual(dto.entries,[]);assert.ok(!JSON.stringify(dto).includes(id));assert.equal((await f.atlas.request(pub+'/stories?q=CAPITULO OCULTO')).value.total,0);
  n=await cmd('stories',n,'reveal-entry',{entryId:id});dto=(await read(f.atlas,'stories',n)).value;assert.equal(dto.entries.length,1);assert.equal(dto.entries[0].text,'TEXTO OCULTO');assert.ok(!JSON.stringify(dto).includes('NOTA DA ENTRADA'));assert.ok(!JSON.stringify(dto).includes('EVENTO OCULTO'));assert.equal((await f.atlas.request(pub+'/stories?q=CAPITULO OCULTO')).value.total,1);
});
test('republicar não sobrescreve capítulo conhecido; remoção preserva jornada até revogação explícita',async()=>{
  let n=await entry(await create('stories'));n=await cmd('stories',n,'publish');n=await cmd('stories',n,'release');const id=n.entries[0].id;n=await cmd('stories',n,'reveal-entry',{entryId:id});n=await entry(n,{title:'TITULO NOVO',text:'TEXTO NOVO'},id);n=await cmd('stories',n,'publish');assert.equal((await read(f.atlas,'stories',n)).value.entries[0].text,'TEXTO OCULTO');
  n=await cmd('stories',n,'reveal-entry',{entryId:id});assert.equal((await read(f.atlas,'stories',n)).value.entries[0].text,'TEXTO NOVO');assert.equal(f.db.prepare('SELECT count(*) n FROM personal_story_reveals WHERE arc_id=?').get(n.id).n,1);
  const removed=await f.master.request(`${base}/stories/${n.id}/entries`,{method:'DELETE',body:{version:n.version,entryId:id}});assert.equal(removed.status,200);n=await cmd('stories',removed.value,'publish');assert.equal((await read(f.atlas,'stories',n)).value.entries[0].text,'TEXTO NOVO');
  n=await cmd('stories',n,'revoke-entry',{entryId:id});assert.deepEqual((await read(f.atlas,'stories',n)).value.entries,[]);assert.equal((await f.atlas.request(pub+'/stories?q=TEXTO NOVO')).value.total,0);
});
test('protagonista fica fixo após liberação; duplicar não transfere capítulos conhecidos',async()=>{
  let n=await entry(await create('stories',{},policy({audience:'ALL'})));n=await cmd('stories',n,'publish');n=await cmd('stories',n,'release');n=await cmd('stories',n,'reveal-entry',{entryId:n.entries[0].id});const before=snapshot();
  assert.equal((await f.master.request(`${base}/stories/${n.id}`,{method:'PATCH',body:{version:n.version,payload:n.payload,policy:n.policy,private:n.private,protagonistId:'eiris'}})).status,409);assert.equal(snapshot(),before);
  let copy=await cmd('stories',n,'duplicate');assert.equal(copy.accessActive,false);assert.equal(copy.protagonistLocked,false);assert.deepEqual(copy.reveals,[]);assert.notEqual(copy.entries[0].id,n.entries[0].id);copy=await edit('stories',copy,{},copy.policy,'eiris');copy=await cmd('stories',copy,'publish');copy=await cmd('stories',copy,'release');assert.deepEqual((await read(f.eiris,'stories',copy)).value.entries,[]);assert.equal((await read(f.atlas,'stories',copy)).status,404);
});
test('entradas são reordenáveis com versão e não aceitam IDs de outro arco ou ordem parcial',async()=>{
  let n=await entry(await create('stories'));n=await entry(n,{title:'Segundo'});const ids=n.entries.map(e=>e.id);n=await cmd('stories',n,'reorder',{entryIds:ids.toReversed()});assert.deepEqual(n.entries.map(e=>e.id),ids.toReversed());
  const before=snapshot();for(const order of [[ids[0]],['forjado',ids[1]],[ids[0],ids[1],ids[1]]])assert.equal((await f.master.request(`${base}/stories/${n.id}/reorder`,{method:'POST',body:{version:n.version,entryIds:order}})).status,400);
  assert.equal((await f.master.request(`${base}/stories/${n.id}/entries`,{method:'POST',body:{version:n.version,entryId:'forjado',payload:entryPayload(),privateNotes:''}})).status,404);assert.equal(snapshot(),before);
});
test('mídias de capítulos exigem revelação e dono; revogação do arco e da entrada bloqueiam bytes',async()=>{
  let n=await entry(await create('stories'),{fileId:file.id,alt:'Capítulo de teste'});n=await cmd('stories',n,'publish');n=await cmd('stories',n,'release');const id=n.entries[0].id;n=await cmd('stories',n,'reveal-entry',{entryId:id});const image=(await read(f.atlas,'stories',n)).value.entries[0].image;assert.equal((await f.atlas.request(image)).status,200);assert.equal((await f.eiris.request(image)).status,404);assert.equal((await f.client().request(image)).status,401);
  n=await cmd('stories',n,'revoke');assert.equal((await f.atlas.request(image)).status,404);n=await cmd('stories',n,'release');assert.equal((await f.atlas.request(image)).status,200);await cmd('stories',n,'revoke-entry',{entryId:id});assert.equal((await f.atlas.request(image)).status,404);
});
test('prévia pura nas quatro Casas usa política real e não libera entrada nem inicia missão',async()=>{
  const q=await create('quests',{fileId:file.id,alt:'Teste'});let s=await entry(await create('stories'));s=await cmd('stories',s,'publish');s=await cmd('stories',s,'release');s=await cmd('stories',s,'reveal-entry',{entryId:s.entries[0].id});
  const before=snapshot();for(const character of ['atlas','eiris','drake','vane'])for(const [domain,n] of [['quests',q],['stories',s]]){
    const r=await f.master.request(`${base}/${domain}/${n.id}/preview?character=${character}&source=draft&mode=${domain==='quests'?'announcement':'diary'}`);assert.equal(r.status,200);assert.equal(r.value.accessible,character==='atlas');assert.ok(!JSON.stringify(r.value).includes('SINOPSE'));assert.ok(!JSON.stringify(r.value).includes('NOTA DA ENTRADA'));
    if(r.value.record?.image)assert.equal((await f.master.request(r.value.record.image)).status,200);
  }
  const actual=await f.master.request(`${pub}/stories/${s.id}?view_as=atlas`);assert.equal(actual.status,200);assert.equal(snapshot(),before);
});
test('concorrência de liberação/entrada não duplica participantes ou versões',async()=>{
  const q=await cmd('quests',await create(),'publish');const results=await Promise.all([1,2].map(()=>f.master.request(`${base}/quests/${q.id}/release`,{method:'POST',body:{version:q.version,characters:['atlas']}})));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(f.db.prepare('SELECT count(*) n FROM quest_participants WHERE quest_id=?').get(q.id).n,1);
  const s=await create('stories');const saves=await Promise.all([1,2].map(()=>f.master.request(`${base}/stories/${s.id}/entries`,{method:'POST',body:{version:s.version,entryId:null,payload:entryPayload(),privateNotes:''}})));assert.deepEqual(saves.map(r=>r.status).sort(),[200,409]);assert.equal(f.db.prepare('SELECT count(*) n FROM personal_story_entries WHERE arc_id=?').get(s.id).n,1);
});
test('grupo/Casa/turma/ano e exclusões restringem anúncio, Diário e histórias no servidor',async()=>{
  await f.master.request('/api/master/characters/atlas',{method:'PATCH',body:{name:'Atlas Black',house:'gryffindor',year:1}});
  const group=(await f.master.request('/api/master/groups',{method:'POST',body:{name:'Narrativa grupo',members:['atlas','eiris']}})).value;
  const cohort=(await f.master.request('/api/master/workshop/cohorts',{method:'POST',body:{name:'Narrativa turma',members:['atlas','eiris']}})).value;
  let n=await cmd('quests',await create('quests',{},policy({characters:[],groups:[group.id],houses:['gryffindor'],schoolYears:[1],cohorts:[cohort.id]})),'publish');n=await cmd('quests',n,'release',{characters:['atlas']});assert.equal((await read(f.atlas,'quests',n)).status,200);assert.equal((await read(f.eiris,'announcements',n)).status,404);
  await f.master.request(`/api/master/workshop/cohorts/${cohort.id}`,{method:'PATCH',body:{version:1,name:'Narrativa turma',members:['eiris']}});assert.equal((await read(f.atlas,'quests',n)).status,404);
  let s=await cmd('stories',await create('stories',{},policy({audience:'ALL',excludedCharacters:['atlas']})),'publish');assert.equal((await f.master.request(`${base}/stories/${s.id}/release`,{method:'POST',body:{version:s.version}})).status,422);s=await edit('stories',s,{},policy({audience:'ALL',regionId:'hogsmeade'}));s=await cmd('stories',s,'publish');assert.equal((await f.master.request(`${base}/stories/${s.id}/release`,{method:'POST',body:{version:s.version}})).status,422);
});
test('publicação/início/revelação não concede item, moeda, certificado, ponto nem registro no Hub',async()=>{
  const tables=f.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r=>r.name).filter(t=>!['quests','quest_participants','quest_revisions','personal_story_arcs','personal_story_entries','personal_story_reveals','story_revisions','audit_log'].includes(t));
  const before=JSON.stringify(tables.map(t=>f.db.prepare(`SELECT * FROM ${t}`).all()));let q=await cmd('quests',await create(),'publish');q=await cmd('quests',q,'release',{characters:['atlas']});await cmd('quests',q,'start',{characters:['atlas']});let s=await entry(await create('stories'));s=await cmd('stories',s,'publish');s=await cmd('stories',s,'release');await cmd('stories',s,'reveal-entry',{entryId:s.entries[0].id});assert.equal(JSON.stringify(tables.map(t=>f.db.prepare(`SELECT * FROM ${t}`).all())),before);
});
test('backup restaurado mantém missão iniciada, arco/capítulo, imagem e isolamento do protagonista',async()=>{
  let q=await cmd('quests',await create(),'publish');q=await cmd('quests',q,'release',{characters:['atlas']});q=await cmd('quests',q,'start',{characters:['atlas']});let s=await entry(await create('stories'),{fileId:file.id,alt:'Teste'});s=await cmd('stories',s,'publish');s=await cmd('stories',s,'release');s=await cmd('stories',s,'reveal-entry',{entryId:s.entries[0].id});s=await cmd('stories',s,'archive');
  const directory=await mkdtemp(join(tmpdir(),'hogwarts-narrative-backup-'));await new Promise(resolve=>f.server.close(resolve));
  try{
    await promisify(execFile)(process.execPath,['--experimental-strip-types','src/cli.ts','backup',directory],{env:{...process.env,DATA_DIR:f.config.dataDir,APP_ORIGIN:f.config.origin,NODE_ENV:'test'}});
    const config={...f.config,dataDir:directory,port:0},restored=createApplication(config);await new Promise(resolve=>restored.server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${restored.server.address().port}`;config.origin=origin;
    try{const get=(path,cookie=f.atlas.cookie)=>fetch(origin+path,{headers:{Cookie:cookie}});assert.equal((await (await get(`${pub}/quests/${q.id}`)).json()).state,'IN_PROGRESS');const dto=await (await get(`${pub}/stories/${s.id}`)).json();assert.equal(dto.entries[0].text,'TEXTO OCULTO');assert.equal(dto.archived,true);assert.equal((await get(dto.entries[0].image)).status,200);assert.equal((await get(`${pub}/stories/${s.id}`,f.eiris.cookie)).status,404);assert.deepEqual(restored.db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(JSON.parse(restored.db.prepare('SELECT private_json FROM personal_story_arcs WHERE id=?').get(s.id).private_json).synopsis,internal().synopsis);}
    finally{await new Promise(resolve=>restored.server.close(resolve));restored.db.close();}
  }finally{await rm(directory,{recursive:true,force:true});}
});
