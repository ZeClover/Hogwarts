import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, cp, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import sharp from 'sharp';
import { fixture } from './helpers.mjs';
import { openDatabase } from '../dist/db.js';
import { createApplication } from '../dist/server.js';
const exec=promisify(execFile);
let f,file;
const policy=(extra={})=>({audience:'SELECTED',characters:['atlas'],groups:[],houses:[],schoolYears:[],cohorts:[],excludedCharacters:[],regionId:null,locationId:null,...extra});
const payload=(extra={})=>({title:'Imagem de teste',description:'Descrição autorizada',alt:'Imagem de teste azul',category:'SCENERY',credit:'Crédito de teste',academicYear:'1890–1891',presentation:'SCENE',fileId:file.id,crop:{x:0,y:0,width:100,height:100},...extra});
async function create(extra={},rules=policy()){
  const r=await f.master.request('/api/master/workshop/media',{method:'POST',body:{payload:payload(extra),policy:rules,privateNotes:'SEGREDO EDITORIAL <script>alert(1)</script>'}});
  assert.equal(r.status,201,JSON.stringify(r.value));return r.value;
}
async function action(item,name){const r=await f.master.request(`/api/master/workshop/media/${item.id}/${name}`,{method:'POST',body:{version:item.version}});assert.equal(r.status,200,JSON.stringify(r.value));return r.value;}
async function edit(item,extra={},rules=item.policy){const r=await f.master.request(`/api/master/workshop/media/${item.id}`,{method:'PATCH',body:{version:item.version,payload:{...item.payload,...extra},policy:rules,privateNotes:item.privateNotes}});assert.equal(r.status,200,JSON.stringify(r.value));return r.value;}
const list=(client,q='')=>client.request(`/api/workshop/media?q=${encodeURIComponent(q)}`);
before(async()=>{
  f=await fixture();
  const bytes=await sharp({create:{width:800,height:600,channels:3,background:'#336699'}}).withExif({IFD0:{Artist:'SEGREDO EXIF'}}).png().toBuffer();
  const uploaded=await f.master.request('/api/master/workshop/files',{method:'POST',body:bytes,headers:{'Content-Type':'image/png'},raw:true});
  assert.equal(uploaded.status,201);file=uploaded.value;
});
after(async()=>{await f?.close();});

test('migração aditiva preserva retratos, contas e referências publicadas da F0/F1',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'hogwarts-migration-'));
  try{
    const migrations=join(directory,'migrations');await mkdir(migrations);await cp('migrations/001_foundation.sql',join(migrations,'001_foundation.sql'));
    const oldConfig={...f.config,dataDir:join(directory,'data'),migrationsDir:migrations};const db=openDatabase(oldConfig);
    db.exec("INSERT INTO users(id,email,password_hash,role) VALUES('master','test@migration.invalid','test-hash','MASTER'); INSERT INTO media(id,owner_character_id,storage_key,mime,bytes) VALUES('portrait','atlas','portrait.webp','image/webp',20); UPDATE characters SET photo_id='portrait',biography='Biografia preservada' WHERE id='atlas'; INSERT INTO publications(id,title,body,kind,status,media_id,campaign_year,published_at) VALUES('old','Publicado','Conteúdo de teste','CONTENT','PUBLISHED','portrait',1890,1)");db.close();
    const migrated=openDatabase({...oldConfig,migrationsDir:resolve('migrations')});
    assert.equal(migrated.prepare("SELECT photo_id FROM characters WHERE id='atlas'").get().photo_id,'portrait');
    assert.equal(migrated.prepare("SELECT biography FROM characters WHERE id='atlas'").get().biography,'Biografia preservada');
    assert.equal(migrated.prepare("SELECT media_id FROM publications WHERE id='old'").get().media_id,'portrait');
    assert.equal(migrated.prepare('SELECT COUNT(*) n FROM workshop_files').get().n,0);
    assert.equal(migrated.prepare('SELECT COUNT(*) n FROM editorial_entries').get().n,0);
    assert.deepEqual(migrated.prepare('PRAGMA foreign_key_check').all(),[]);migrated.close();
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('Mestre envia mídia com autoria administrativa; metadados EXIF e nomes físicos não trafegam',async()=>{
  assert.equal(file.width,800);assert.equal(file.height,600);assert.equal(file.originalAlreadyPublic,false);
  const original=await f.master.request(file.image);assert.equal(original.status,200);
  const meta=await sharp(original.value).metadata();assert.equal(meta.exif,undefined);assert.equal(meta.format,'webp');
  assert.equal(original.headers.get('cache-control'),'no-store');
  assert.equal(f.db.prepare('SELECT owner_character_id FROM media WHERE id=?').get(file.id),undefined);
  assert.ok(f.db.prepare('SELECT owner_user_id FROM workshop_files WHERE id=?').get(file.id).owner_user_id);
  assert.ok(!JSON.stringify(file).includes('storage_key'));
});
test('PLAYER e anônimo não acessam editores, uploads, arquivos originais, histórico ou turmas',async()=>{
  const item=await create();
  for(const client of [f.atlas,f.client()]){
    const expected=client===f.atlas?403:401;
    for(const path of ['/api/master/workshop/context','/api/master/workshop/media',file.image,`/api/master/workshop/media/${item.id}`,`/api/master/workshop/media/${item.id}/history`])assert.equal((await client.request(path)).status,expected);
    assert.equal((await client.request('/api/master/workshop/files',{method:'POST',body:{asset:'hogwarts.webp'}})).status,expected);
    assert.equal((await client.request('/api/master/workshop/cohorts',{method:'POST',body:{name:'Turma',members:[]}})).status,expected);
  }
  assert.equal((await f.master.request('/api/master/workshop/context?view_as=atlas')).status,403);
  assert.equal((await f.master.request(`/api/master/workshop/media/${item.id}/publish?view_as=atlas`,{method:'POST',body:{version:1}})).status,403);
});
test('CSRF/origem e validação de arquivo continuam obrigatórios na Oficina',async()=>{
  assert.equal((await f.master.request('/api/master/workshop/files',{method:'POST',body:{asset:'hogwarts.webp'},csrf:false})).status,403);
  assert.equal((await f.master.request('/api/master/workshop/files',{method:'POST',body:{asset:'hogwarts.webp'},origin:false})).status,403);
  for(const asset of ['../.env','/etc/passwd','https://example.invalid/image.webp'])assert.equal((await f.master.request('/api/master/workshop/files',{method:'POST',body:{asset}})).status,400);
  assert.equal((await f.master.request('/api/master/workshop/files',{method:'POST',raw:true,body:Buffer.from('<svg/>'),headers:{'Content-Type':'image/png'}})).status,415);
  assert.equal((await f.master.request('/api/master/workshop/files',{method:'POST',raw:true,body:Buffer.alloc(2*1024*1024+1),headers:{'Content-Type':'image/png'}})).status,413);
  assert.equal((await f.master.request('/api/master/workshop/files',{method:'POST',body:{asset:'hogwarts.webp',url:'https://example.invalid/'}})).status,400);
});
test('arte V4 pode ser selecionada; registro informa que o original de ambientação já é público',async()=>{
  const r=await f.master.request('/api/master/workshop/files',{method:'POST',body:{asset:'biblioteca_hogwarts.webp'}});
  assert.equal(r.status,201);assert.equal(r.value.originalAlreadyPublic,true);
  assert.equal((await f.atlas.request(r.value.image)).status,403);
  assert.equal((await f.client().request('/assets/biblioteca_hogwarts.webp')).status,200);
});
test('rascunho, preparado e duplicação não publicam nem aparecem na busca do jogador',async()=>{
  let item=await create({title:'NAO PUBLICADO'});
  assert.equal((await f.atlas.request(`/api/workshop/media/${item.id}`)).status,404);
  assert.equal((await list(f.atlas,'NAO PUBLICADO')).value.total,0);
  item=await action(item,'prepare');assert.equal(item.status,'PREPARED');
  assert.equal((await f.atlas.request(`/api/workshop/media/${item.id}`)).status,404);
  const copy=await action(item,'duplicate');assert.equal(copy.status,'DRAFT');assert.notEqual(copy.id,item.id);
  assert.equal((await f.atlas.request(`/api/workshop/media/${copy.id}`)).status,404);
  assert.equal((await f.master.request(`/api/master/workshop/media/${item.id}/publish`,{method:'POST',body:{version:item.version},csrf:false})).status,403);
});
test('publicação entrega apenas projeção autorizada e impede vazamentos por busca/contagem/miniatura',async()=>{
  let item=await create({title:'PUBLICADO PARA ATLAS'});item=await action(item,'publish');
  const own=await f.atlas.request(`/api/workshop/media/${item.id}`);assert.equal(own.status,200);
  for(const hidden of ['privateNotes','fileId','owner_user_id','draft','policy','SEGREDO','version','storage_key'])assert.ok(!JSON.stringify(own.value).includes(hidden),hidden);
  const photo=await f.atlas.request(own.value.image+'&variant=thumb');assert.equal(photo.status,200);assert.equal(photo.headers.get('cache-control'),'no-store');
  assert.equal((await f.eiris.request(`/api/workshop/media/${item.id}`)).status,404);
  assert.equal((await f.eiris.request(own.value.image)).status,404);
  assert.equal((await list(f.eiris,'PUBLICADO PARA ATLAS')).value.total,0);
  assert.equal((await list(f.atlas,'SEGREDO EDITORIAL')).value.total,0);
  assert.equal((await f.client().request(own.value.image)).status,401);
  assert.equal((await f.atlas.request(`/api/workshop/media/${item.id}/image?stamp=incorreto`)).status,404);
});
test('editar título/corte/destinatários não altera a revisão publicada antes de republicar',async()=>{
  let item=await action(await create({title:'VERSAO ANTIGA'}),'publish');
  const previous=(await f.atlas.request(`/api/workshop/media/${item.id}`)).value;
  item=await edit(item,{title:'VERSAO NOVA',crop:{x:10,y:10,width:50,height:50}},policy({characters:['eiris']}));
  assert.equal(item.hasUnpublishedChanges,true);
  assert.equal((await f.atlas.request(`/api/workshop/media/${item.id}`)).value.title,'VERSAO ANTIGA');
  assert.equal((await list(f.atlas,'VERSAO NOVA')).value.total,0);assert.equal((await f.eiris.request(`/api/workshop/media/${item.id}`)).status,404);
  item=await action(item,'publish');
  assert.equal((await f.atlas.request(previous.image)).status,404);
  const next=await f.eiris.request(`/api/workshop/media/${item.id}`);assert.equal(next.value.title,'VERSAO NOVA');
  const image=await f.eiris.request(next.value.image);const meta=await sharp(image.value).metadata();assert.equal(meta.width,400);assert.equal(meta.height,300);
});
test('conflito de duas sessões retorna 409 e histórico guarda antes/depois sem perda',async()=>{
  const before=await create({title:'CONCORRENCIA'});
  const updated=await edit(before,{description:'Primeira mudança'});
  const conflict=await f.master.request(`/api/master/workshop/media/${before.id}`,{method:'PATCH',body:{version:before.version,payload:{...before.payload,description:'Sobrescrita indevida'},policy:before.policy,privateNotes:''}});
  assert.equal(conflict.status,409);assert.equal(f.db.prepare('SELECT version FROM editorial_entries WHERE id=?').get(before.id).version,updated.version);
  const history=await f.master.request(`/api/master/workshop/media/${before.id}/history`);
  assert.equal(history.value.items.length,2);assert.equal(history.value.items[0].snapshot.payload.description,'Primeira mudança');assert.equal(history.value.items[1].snapshot.payload.description,'Descrição autorizada');
  assert.ok(history.value.items[0].snapshot.privateNotes.includes('SEGREDO EDITORIAL'));
  const count=f.db.prepare('SELECT COUNT(*) n FROM editorial_revisions WHERE entry_id=?').get(before.id).n;assert.equal(count,2);
});
test('público por Casa, ano, grupo, turma e exclusão individual é aplicado no servidor',async()=>{
  const created=await f.master.request('/api/master/workshop/cohorts',{method:'POST',body:{name:'TURMA DE TESTE',members:['atlas','eiris']}});const cohort=created.value.id;
  const group=await f.master.request('/api/master/groups',{method:'POST',body:{name:'GRUPO DE TESTE',members:['atlas','eiris']}});
  await f.master.request('/api/master/characters/atlas',{method:'PATCH',body:{name:'Atlas Black',house:'gryffindor',year:1}});
  await f.master.request('/api/master/characters/eiris',{method:'PATCH',body:{name:'Eiris Scamander',house:'hufflepuff',year:1}});
  let item=await action(await create({title:'ESCOPO COMBINADO'},policy({characters:[],groups:[group.value.id],houses:['gryffindor'],schoolYears:[1],cohorts:[cohort]})),'publish');
  assert.equal((await f.atlas.request(`/api/workshop/media/${item.id}`)).status,200);assert.equal((await f.eiris.request(`/api/workshop/media/${item.id}`)).status,404);
  item=await edit(item,{},policy({audience:'ALL',excludedCharacters:['atlas']}));item=await action(item,'publish');
  assert.equal((await f.atlas.request(`/api/workshop/media/${item.id}`)).status,404);assert.equal((await f.eiris.request(`/api/workshop/media/${item.id}`)).status,200);
  item=await edit(item,{},policy({audience:'ALL',cohorts:[cohort]}));item=await action(item,'publish');
  assert.equal((await f.atlas.request(`/api/workshop/media/${item.id}`)).status,200);
  const changed=await f.master.request(`/api/master/workshop/cohorts/${cohort}`,{method:'PATCH',body:{name:'TURMA DE TESTE',version:1,members:['eiris']}});assert.equal(changed.status,200);
  assert.equal((await f.atlas.request(`/api/workshop/media/${item.id}`)).status,404);
  assert.equal((await f.master.request(`/api/master/workshop/cohorts/${cohort}`,{method:'PATCH',body:{name:'Stale',version:1,members:[]}})).status,409);
});
test('região fechada e local secreto prevalecem sobre público ALL inclusive na imagem',async()=>{
  const item=await action(await create({title:'REGIAO FECHADA'},policy({audience:'ALL',regionId:'hogsmeade',locationId:'olivaras'})),'publish');
  assert.equal((await f.atlas.request(`/api/workshop/media/${item.id}`)).status,404);
  await f.master.request('/api/master/regions/hogsmeade',{method:'PATCH',body:{isOpen:true,audience:'ALL',characters:[],groups:[]}});
  const visible=await f.atlas.request(`/api/workshop/media/${item.id}`);assert.equal(visible.status,200);
  await f.master.request('/api/master/locations/olivaras',{method:'PATCH',body:{enabled:true,isSecret:true,audience:'ALL',characters:['eiris'],groups:[],x:61,y:20}});
  assert.equal((await f.atlas.request(visible.value.image)).status,404);assert.equal((await f.eiris.request(`/api/workshop/media/${item.id}`)).status,200);
});
test('prévia de rascunho considera permissão real, filtra segredos e não grava nada',async()=>{
  const item=await create({title:'PREVIA PRIVADA'}),before=JSON.stringify(f.db.prepare('SELECT * FROM audit_log').all());
  const revisions=JSON.stringify(f.db.prepare('SELECT * FROM editorial_revisions').all());
  const allowed=await f.master.request(`/api/master/workshop/media/${item.id}/preview?character=atlas&source=draft`);
  assert.equal(allowed.value.accessible,true);assert.ok(!JSON.stringify(allowed.value).includes('SEGREDO EDITORIAL'));
  assert.equal((await f.master.request(allowed.value.media.image)).status,200);
  const denied=await f.master.request(`/api/master/workshop/media/${item.id}/preview?character=eiris&source=draft`);
  assert.deepEqual(denied.value,{accessible:false,preview:true,media:null});
  assert.equal((await f.eiris.request(allowed.value.media.image)).status,403);
  assert.equal((await f.master.request(`/api/workshop/media?view_as=atlas&q=PREVIA PRIVADA`)).value.total,0);
  assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM audit_log').all()),before);
  assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM editorial_revisions').all()),revisions);
});
test('arquivar preserva bytes/histórico e restaurar exige publicação explícita',async()=>{
  let item=await action(await create({title:'ARQUIVO'}),'publish');const publicDTO=(await f.atlas.request(`/api/workshop/media/${item.id}`)).value;
  item=await action(item,'archive');assert.equal((await f.atlas.request(publicDTO.image)).status,404);
  const data=f.db.prepare('SELECT storage_key FROM workshop_files WHERE id=?').get(file.id);assert.ok((await readFile(join(f.config.dataDir,'media',data.storage_key))).length);
  item=await action(item,'restore');assert.equal(item.status,'PREPARED');assert.equal((await f.atlas.request(`/api/workshop/media/${item.id}`)).status,404);
  item=await action(item,'publish');assert.equal((await f.atlas.request(`/api/workshop/media/${item.id}`)).status,200);
  assert.equal((await f.master.request(`/api/master/workshop/media/${item.id}/history`)).value.items.length,5);
});
test('formulários inválidos não geram revisão, arquivo público ou política aberta',async()=>{
  const count=f.db.prepare('SELECT COUNT(*) n FROM editorial_entries').get().n;
  for(const bad of [payload({crop:{x:80,y:0,width:50,height:100}}),payload({fileId:'nao-existe'}),payload({academicYear:'2090–2091'})]){
    assert.equal((await f.master.request('/api/master/workshop/media',{method:'POST',body:{payload:bad,policy:policy()}})).status,400);
  }
  assert.equal((await f.master.request('/api/master/workshop/media',{method:'POST',body:{payload:payload(),policy:policy({characters:['nao-existe']})}})).status,400);
  const item=await create({alt:''});const rejected=await f.master.request(`/api/master/workshop/media/${item.id}/publish`,{method:'POST',body:{version:item.version}});assert.equal(rejected.status,422);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM editorial_entries').get().n,count+1);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM editorial_revisions WHERE entry_id=?').get(item.id).n,1);
  const restored=await action(await action(item,'archive'),'restore');assert.equal(restored.status,'DRAFT');
});
test('backup e reinício preservam revisões, públicos e arquivos; restauração serve o conteúdo autorizado',async()=>{
  const item=await action(await create({title:'PERSISTENCIA RESTAURADA'}),'publish');
  const directory=await mkdtemp(join(tmpdir(),'hogwarts-backup-'));
  await new Promise(resolve=>f.server.close(resolve));
  try{
    await exec(process.execPath,['--experimental-strip-types','src/cli.ts','backup',directory],{env:{...process.env,DATA_DIR:f.config.dataDir,APP_ORIGIN:f.config.origin,NODE_ENV:'test'}});
    const check=new DatabaseSync(join(directory,'hogwarts.sqlite'));
    assert.equal(check.prepare('SELECT status FROM editorial_entries WHERE id=?').get(item.id).status,'PUBLISHED');assert.equal(check.prepare('SELECT COUNT(*) n FROM editorial_revisions WHERE entry_id=?').get(item.id).n,2);check.close();
    const config={...f.config,dataDir:directory,port:0};const restored=createApplication(config);
    await new Promise(resolve=>restored.server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${restored.server.address().port}`;config.origin=origin;
    try{
      const response=await fetch(origin+`/api/workshop/media/${item.id}`,{headers:{Cookie:f.atlas.cookie}});assert.equal(response.status,200);const content=await response.json();assert.equal(content.title,'PERSISTENCIA RESTAURADA');
      assert.equal((await fetch(origin+content.image,{headers:{Cookie:f.atlas.cookie}})).status,200);
      assert.equal((await fetch(origin+content.image,{headers:{Cookie:f.eiris.cookie}})).status,404);
    }finally{await new Promise(resolve=>restored.server.close(resolve));restored.db.close();}
  }finally{await rm(directory,{recursive:true,force:true});}
});
