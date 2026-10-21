import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { createApplication } from '../dist/server.js';
import { openDatabase } from '../dist/db.js';
import { fixture } from './helpers.mjs';
let f,file;
const base='/api/master/workshop/items',pub='/api/workshop/items';
const policy=(extra={})=>({audience:'SELECTED',characters:['atlas'],groups:[],houses:[],schoolYears:[],cohorts:[],excludedCharacters:[],regionId:null,locationId:null,...extra});
const payload=(extra={})=>({name:'ARTIGO DE TESTE',description:'Descrição revelada',fileId:null,alt:'',crop:{x:0,y:0,width:100,height:100},...extra});
const internal=(extra={})=>({category:'CATEGORIA SECRETA',quality:'QUALIDADE SECRETA',materials:'MATERIAL SECRETO',properties:'PROPRIEDADE SECRETA',magicDegree:'GRAU SECRETO',activation:'ATIVACAO SECRETA',uses:'CARGAS SECRETAS',frequency:'FREQUENCIA SECRETA',craftingComplexity:'COMPLEXIDADE SECRETA',availability:'DISPONIBILIDADE SECRETA',rarity:'RARIDADE SECRETA',requirements:'REQUISITO SECRETO',secretText:'SEGREDO <script>alert(1)</script>',notes:'NOTAS PRIVADAS',referenceValueNuques:5678,chosenPriceNuques:9876,effects:[],...extra});
const effect=(extra={})=>({id:null,name:'EFEITO INTERNO',description:'DESCRICAO INTERNA',magicDegree:'',activation:'',uses:'',frequency:'',requirements:'',...extra});
async function create(extra={},rules=policy(),privateData=internal()){const r=await f.master.request(base,{method:'POST',body:{payload:payload(extra),policy:rules,private:privateData}});assert.equal(r.status,201,JSON.stringify(r.value));return r.value;}
async function command(n,action){const r=await f.master.request(`${base}/${n.id}/${action}`,{method:'POST',body:{version:n.version}});assert.equal(r.status,200,JSON.stringify(r.value));return r.value;}
async function edit(n,extra={},rules=n.policy,privateData=n.private){const r=await f.master.request(`${base}/${n.id}`,{method:'PATCH',body:{version:n.version,payload:{...n.payload,...extra},policy:rules,private:privateData}});assert.equal(r.status,200,JSON.stringify(r.value));return r.value;}
const get=(client,n)=>client.request(`${pub}/${n.id}`);
const snapshot=()=>JSON.stringify(['catalog_items','item_revisions','audit_log','sessions','npc_reveals'].map(t=>f.db.prepare(`SELECT * FROM ${t}`).all()));
before(async()=>{f=await fixture();const bytes=await sharp({create:{width:800,height:600,channels:3,background:'#335577'}}).png().toBuffer();file=(await f.master.request('/api/master/workshop/files',{method:'POST',raw:true,body:bytes,headers:{'Content-Type':'image/png'}})).value;});
after(async()=>{await f?.close();});

test('migração de F2.0b preserva NPCs, mídia e permissões e não semeia itens',async()=>{
  assert.equal(f.db.prepare('SELECT count(*) n FROM catalog_items').get().n,0);
  const directory=await mkdtemp(join(tmpdir(),'hogwarts-items-migration-'));
  try{
    const migrations=join(directory,'migrations');await mkdir(migrations);for(const name of ['001_foundation.sql','002_workshop_media.sql','003_npc_workshop.sql'])await cp('migrations/'+name,join(migrations,name));
    const config={...f.config,dataDir:join(directory,'data'),migrationsDir:migrations},db=openDatabase(config);
    db.exec("INSERT INTO users(id,email,password_hash,role) VALUES('master','migration@test.invalid','test','MASTER'); INSERT INTO media(id,owner_character_id,storage_key,mime,bytes) VALUES('portrait','atlas','portrait.webp','image/webp',20); UPDATE characters SET photo_id='portrait',biography='Preservada' WHERE id='atlas'; INSERT INTO npcs(id,owner_user_id,draft_json,draft_policy_json,private_notes) VALUES('npc','master','{\"name\":\"Preservado\"}','{\"audience\":\"SELECTED\"}','SEGREDO NPC'); INSERT INTO npc_revisions(npc_id,version,actor_id,action,snapshot_json) VALUES('npc',1,'master','CREATED','{}'); INSERT INTO npc_location_links(npc_id,location_id) VALUES('npc','biblioteca')");
    const old=JSON.stringify(['characters','npcs','npc_revisions','npc_location_links','media'].map(t=>db.prepare(`SELECT * FROM ${t}`).all()));db.close();
    const migrated=openDatabase({...config,migrationsDir:resolve('migrations')});assert.equal(JSON.stringify(['characters','npcs','npc_revisions','npc_location_links','media'].map(t=>migrated.prepare(`SELECT * FROM ${t}`).all())),old);assert.equal(migrated.prepare('SELECT count(*) n FROM catalog_items').get().n,0);assert.deepEqual(migrated.prepare('PRAGMA foreign_key_check').all(),[]);migrated.close();
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('API administrativa, referências, revisões e originais negam PLAYER/anônimo e view_as',async()=>{
  const n=await create({fileId:file.id,alt:'Imagem de teste'});
  for(const client of [f.atlas,f.client()])for(const path of [base,base+'/references',`${base}/${n.id}`,`${base}/${n.id}/history`,`${base}/${n.id}/image?version=1`,`${base}/${n.id}/preview?character=atlas`,`${base}/${n.id}/preview-image?character=atlas`,file.image])assert.equal((await client.request(path)).status,client===f.atlas?403:401,path);
  for(const path of [base,base+'/references',`${base}/${n.id}/history`,`${base}/${n.id}/image?version=1`])assert.equal((await f.master.request(path+(path.includes('?')?'&':'?')+'view_as=atlas')).status,403);
  for(const action of ['prepare','publish','duplicate','archive','restore']){
    assert.equal((await f.atlas.request(`${base}/${n.id}/${action}`,{method:'POST',body:{version:1}})).status,403);
    assert.equal((await f.master.request(`${base}/${n.id}/${action}?view_as=atlas`,{method:'POST',body:{version:1}})).status,403);
    assert.equal((await f.master.request(`${base}/${n.id}/${action}`,{method:'POST',body:{version:1},csrf:false})).status,403);
  }
  assert.equal((await f.master.request(base,{method:'POST',body:{},origin:false})).status,403);assert.equal((await f.client().request(pub)).status,401);
});
test('rascunho, preparado e cópia ficam fora de busca, contagem, referências e URL forçada',async()=>{
  let n=await create({name:'ITEM AINDA PRIVADO'});n=await command(n,'prepare');const copy=await command(n,'duplicate');assert.equal(copy.status,'DRAFT');
  for(const item of [n,copy])for(const suffix of ['', '/copy','/image?stamp=wrong'])assert.equal((await f.atlas.request(pub+'/'+item.id+suffix)).status,404);
  for(const path of [pub,pub+'/references']){const r=await f.atlas.request(path+'?q=ITEM AINDA PRIVADO');assert.equal(r.value.total,0);assert.ok(!JSON.stringify(r.value).includes(n.id));}
});
test('projeção pública e cópia contêm só campos revelados; filtros não permitem inferir preços/efeitos',async()=>{
  const n=await command(await create({name:'ARTIGO AUTORIZADO',fileId:file.id,alt:'Ilustração autorizada'},policy(),internal({effects:[effect()]})),'publish');
  const own=await get(f.atlas,n);assert.equal(own.status,200);assert.deepEqual(Object.keys(own.value).sort(),['alt','description','id','image','name']);
  const copy=await f.atlas.request(pub+'/'+n.id+'/copy');assert.deepEqual(copy.value,{text:'ARTIGO AUTORIZADO\n\nDescrição revelada'});
  for(const secret of ['5678','9876','SEGREDO','INTERNO','CATEGORIA','secretText','private','quality','effects','crop','fileId','policy','version'])for(const value of [own.value,copy.value,(await f.atlas.request(pub+'?q=ARTIGO AUTORIZADO')).value,(await f.atlas.request(pub+'/references?q=ARTIGO AUTORIZADO')).value])assert.ok(!JSON.stringify(value).includes(secret),secret);
  for(const q of ['9876','SEGREDO','CATEGORIA SECRETA','EFEITO INTERNO'])assert.equal((await f.atlas.request(pub+'?q='+encodeURIComponent(q))).value.total,0);
  assert.equal((await f.atlas.request(pub+'?q=ARTIGO AUTORIZADO&category=NAO_EXISTE&status=DRAFT')).value.total,1);
  assert.equal((await get(f.eiris,n)).status,404);assert.equal((await f.eiris.request(pub+'/'+n.id+'/copy')).status,404);assert.equal((await f.eiris.request(own.value.image)).status,404);assert.equal((await f.client().request(own.value.image)).status,401);
});
test('publicar não cria loja, ofertas, posse, dinheiro, descoberta ou vínculos automáticos',async()=>{
  const tables=f.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r=>r.name).filter(t=>!['catalog_items','item_revisions','audit_log'].includes(t));
  const before=JSON.stringify(tables.map(t=>f.db.prepare(`SELECT * FROM ${t}`).all()));const n=await command(await create(), 'publish');
  assert.equal(JSON.stringify(tables.map(t=>f.db.prepare(`SELECT * FROM ${t}`).all())),before);
  for(const id of ['biblioteca','olivaras'])assert.ok(!(await f.master.request('/api/locations/'+id)).value.items.some(i=>i.id===n.id));
});
test('editar nome/imagem/corte/público preserva publicado até nova confirmação',async()=>{
  let n=await command(await create({name:'REVISAO ANTERIOR',fileId:file.id,alt:'Anterior'}),'publish');const old=(await get(f.atlas,n)).value;
  n=await edit(n,{name:'REVISAO NOVA',crop:{x:10,y:10,width:50,height:50}},policy({characters:['eiris']}));assert.equal(n.hasUnpublishedChanges,true);assert.equal((await get(f.atlas,n)).value.name,'REVISAO ANTERIOR');assert.equal((await get(f.eiris,n)).status,404);
  assert.equal((await sharp((await f.atlas.request(old.image)).value).metadata()).width,800);n=await command(n,'publish');assert.equal((await f.atlas.request(old.image)).status,404);
  const next=(await get(f.eiris,n)).value;assert.equal(next.name,'REVISAO NOVA');const metadata=await sharp((await f.eiris.request(next.image)).value).metadata();assert.equal(metadata.width,400);assert.equal(metadata.height,300);
});
test('efeitos editáveis/reordenáveis mantêm IDs; cópia gera identidades independentes',async()=>{
  let n=await create({},policy(),internal({effects:[effect({name:'Primeiro'}),effect({name:'Segundo'})]}));const ids=n.private.effects.map(e=>e.id);assert.notEqual(ids[0],ids[1]);
  n=await edit(n,{},n.policy,{...n.private,effects:[{...n.private.effects[1],description:'Alterado'},n.private.effects[0],effect({name:'Terceiro'})]});assert.deepEqual(n.private.effects.map(e=>e.name),['Segundo','Primeiro','Terceiro']);assert.deepEqual(n.private.effects.slice(0,2).map(e=>e.id),[ids[1],ids[0]]);
  const copy=await command(n,'duplicate');assert.notEqual(copy.id,n.id);assert.ok(copy.private.effects.every(e=>!n.private.effects.some(p=>p.id===e.id)));assert.equal(copy.status,'DRAFT');
  n=await edit(n,{},n.policy,{...n.private,effects:n.private.effects.slice(1)});assert.equal(n.private.effects.length,2);
  const history=(await f.master.request(`${base}/${n.id}/history`)).value.items;assert.equal(history[0].snapshot.private.effects.length,2);assert.equal(history[1].snapshot.private.effects.length,3);
});
test('valores privados são inteiros independentes, opcionais e sem obrigação de seguir estimativa',async()=>{
  let n=await create({},policy(),internal({referenceValueNuques:493,chosenPriceNuques:1}));assert.equal(n.private.referenceValueNuques,493);assert.equal(n.private.chosenPriceNuques,1);
  n=await edit(n,{},n.policy,{...n.private,referenceValueNuques:null,chosenPriceNuques:0});assert.equal(n.private.referenceValueNuques,null);assert.equal(n.private.chosenPriceNuques,0);
  for(const value of [-1,1.5,1_000_000_000_001,Number.MAX_SAFE_INTEGER,'493']){const before=snapshot();const r=await f.master.request(base,{method:'POST',body:{payload:payload(),policy:policy(),private:internal({chosenPriceNuques:value})}});assert.equal(r.status,400);assert.equal(snapshot(),before);}
});
test('validação recusa efeito de outro item, duplicação, corte inválido e publicação sem alt',async()=>{
  let n=await create({},policy(),internal({effects:[effect()]}));const before=snapshot();
  for(const effects of [[{...effect(),id:'forjado'}],[n.private.effects[0],n.private.effects[0]],Array.from({length:13},()=>effect())])assert.equal((await f.master.request(`${base}/${n.id}`,{method:'PATCH',body:{version:n.version,payload:n.payload,policy:n.policy,private:{...n.private,effects}}})).status,400);
  assert.equal(snapshot(),before);
  for(const p of [payload({fileId:'forjado'}),payload({crop:{x:80,y:0,width:50,height:100}}),{...payload(),chosenPriceNuques:0}])assert.equal((await f.master.request(base,{method:'POST',body:{payload:p,policy:policy(),private:internal()}})).status,400);
  n=await edit(n,{fileId:file.id,alt:''});assert.equal((await f.master.request(`${base}/${n.id}/publish`,{method:'POST',body:{version:n.version}})).status,422);
  n=await edit(n,{fileId:null,alt:''});assert.equal((await command(n,'prepare')).status,'PREPARED');
});
test('formulário completo Unicode e limite de corpo ficam contidos no endpoint de itens',async()=>{
  const n=await create({description:'🪄'.repeat(1400)},policy(),internal({secretText:'🪄'.repeat(1900),effects:Array.from({length:12},(_,i)=>effect({name:'Efeito '+i,description:'🪄'.repeat(290)}))}));assert.equal(n.private.effects.length,12);
  assert.equal((await f.master.request(base,{method:'POST',body:{padding:'X'.repeat(262_144)}})).status,413);
  assert.equal((await f.master.request('/api/master/workshop/npcs',{method:'POST',body:{padding:'X'.repeat(32_768)}})).status,413);
});
test('conflito de duas sessões não sobrescreve rascunho nem cria revisão parcial',async()=>{
  const n=await create();const results=await Promise.all(['Primeiro','Segundo'].map(description=>f.master.request(`${base}/${n.id}`,{method:'PATCH',body:{version:n.version,payload:{...n.payload,description},policy:n.policy,private:n.private}})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);const history=(await f.master.request(`${base}/${n.id}/history`)).value.items;assert.equal(history.length,2);assert.equal(history[1].snapshot.payload.description,'Descrição revelada');
});
test('restrições de turma/Casa/ano/grupo/contexto e exceções afetam também imagens e cópia',async()=>{
  await f.master.request('/api/master/characters/atlas',{method:'PATCH',body:{name:'Atlas Black',house:'gryffindor',year:1}});
  const cohort=(await f.master.request('/api/master/workshop/cohorts',{method:'POST',body:{name:'Itens turma',members:['atlas','eiris']}})).value;
  const group=(await f.master.request('/api/master/groups',{method:'POST',body:{name:'Itens grupo',members:['atlas','eiris']}})).value;
  let n=await command(await create({fileId:file.id,alt:'Teste'},policy({characters:[],groups:[group.id],houses:['gryffindor'],schoolYears:[1],cohorts:[cohort.id]})),'publish');
  assert.equal((await get(f.atlas,n)).status,200);assert.equal((await get(f.eiris,n)).status,404);
  await f.master.request(`/api/master/workshop/cohorts/${cohort.id}`,{method:'PATCH',body:{version:1,name:'Itens turma',members:['eiris']}});assert.equal((await get(f.atlas,n)).status,404);
  n=await edit(n,{},policy({audience:'ALL',excludedCharacters:['atlas']}));n=await command(n,'publish');assert.equal((await get(f.atlas,n)).status,404);assert.equal((await get(f.eiris,n)).status,200);
  n=await edit(n,{},policy({audience:'ALL',regionId:'hogsmeade',locationId:'olivaras'}));n=await command(n,'publish');assert.equal((await get(f.eiris,n)).status,404);
  await f.master.request('/api/master/regions/hogsmeade',{method:'PATCH',body:{isOpen:true,audience:'ALL',characters:[],groups:[]}});const visible=(await get(f.atlas,n)).value;assert.ok(visible.image);
  await f.master.request('/api/master/locations/olivaras',{method:'PATCH',body:{enabled:true,isSecret:true,audience:'ALL',characters:['eiris'],groups:[],x:61,y:20}});
  assert.equal((await f.atlas.request(visible.image)).status,404);assert.equal((await f.atlas.request(pub+'/'+n.id+'/copy')).status,404);assert.equal((await get(f.eiris,n)).status,200);
});
test('prévia nas quatro Casas é pura, sem preços/segredos, e não dá acesso ao rascunho real',async()=>{
  const characters=['atlas','eiris','drake','vane'];let n=await command(await create({name:'PUBLICADO',fileId:file.id,alt:'Teste'}),'publish');n=await edit(n,{name:'RASCUNHO'});
  const before=snapshot();for(const character of characters)for(const source of ['draft','published']){
    const r=await f.master.request(`${base}/${n.id}/preview?character=${character}&source=${source}`);assert.equal(r.status,200);assert.equal(r.value.accessible,character==='atlas');assert.ok(!JSON.stringify(r.value).includes('9876'));assert.ok(!JSON.stringify(r.value).includes('SEGREDO'));
    if(character==='atlas'){assert.equal(r.value.item.name,source==='draft'?'RASCUNHO':'PUBLICADO');assert.equal((await f.master.request(r.value.item.image)).status,200);assert.equal((await f.atlas.request(r.value.item.image)).status,403);}
  }
  assert.equal((await f.master.request(`${pub}/${n.id}?view_as=atlas`)).value.name,'PUBLICADO');assert.equal(snapshot(),before);
});
test('arquivar preserva bytes/revisões e restaurar ou duplicar não republica',async()=>{
  let n=await command(await create({fileId:file.id,alt:'Teste'}),'publish');const image=(await get(f.atlas,n)).value.image;n=await command(n,'archive');assert.equal((await f.atlas.request(image)).status,404);
  assert.equal((await f.master.request(file.image)).status,200);const copy=await command(n,'duplicate');assert.equal(copy.status,'DRAFT');n=await command(n,'restore');assert.equal(n.status,'DRAFT');assert.equal((await get(f.atlas,n)).status,404);assert.equal((await get(f.atlas,copy)).status,404);
  n=await command(n,'publish');assert.equal((await get(f.atlas,n)).status,200);assert.equal((await f.master.request(`${base}/${n.id}/history`)).value.items.length,5);
});
test('backup/restauração mantém campos privados, ordem dos efeitos, imagem e autorização',async()=>{
  const n=await command(await create({name:'PERSISTENCIA ITEM',fileId:file.id,alt:'Teste'},policy(),internal({effects:[effect({name:'Um'}),effect({name:'Dois'})]})),'publish');
  const directory=await mkdtemp(join(tmpdir(),'hogwarts-items-backup-'));await new Promise(resolve=>f.server.close(resolve));
  try{
    await promisify(execFile)(process.execPath,['--experimental-strip-types','src/cli.ts','backup',directory],{env:{...process.env,DATA_DIR:f.config.dataDir,APP_ORIGIN:f.config.origin,NODE_ENV:'test'}});
    const config={...f.config,dataDir:directory,port:0},restored=createApplication(config);await new Promise(resolve=>restored.server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${restored.server.address().port}`;config.origin=origin;
    try{const r=await fetch(origin+`${pub}/${n.id}`,{headers:{Cookie:f.atlas.cookie}});assert.equal(r.status,200);const dto=await r.json();assert.equal(dto.name,'PERSISTENCIA ITEM');assert.equal((await fetch(origin+dto.image,{headers:{Cookie:f.atlas.cookie}})).status,200);assert.equal((await fetch(origin+`${pub}/${n.id}/copy`,{headers:{Cookie:f.eiris.cookie}})).status,404);const saved=JSON.parse(restored.db.prepare('SELECT private_json FROM catalog_items WHERE id=?').get(n.id).private_json);assert.equal(saved.chosenPriceNuques,9876);assert.deepEqual(saved.effects.map(e=>e.name),['Um','Dois']);assert.equal(restored.db.prepare('SELECT count(*) n FROM item_revisions WHERE item_id=?').get(n.id).n,2);assert.deepEqual(restored.db.prepare('PRAGMA foreign_key_check').all(),[]);}
    finally{await new Promise(resolve=>restored.server.close(resolve));restored.db.close();}
  }finally{await rm(directory,{recursive:true,force:true});}
});
