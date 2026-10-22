import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createClient } from '@libsql/client';
import { localDatabase, remoteDatabase } from '../dist/async-db.js';
import { createApplication } from '../dist/server.js';
import { migrateCloudDatabase } from '../dist/cloud-db.js';
import { archiveInput } from '../dist/archive-uploads.js';
import { privateStorage } from '../dist/storage.js';
import { fixture } from './helpers.mjs';

test('rollback assíncrono não expõe escritas parciais a outro pedido local',async()=>{
  const db=localDatabase(new DatabaseSync(':memory:'));
  try{
    await db.exec('CREATE TABLE entries(value INTEGER)');
    const entered=Promise.withResolvers(),release=Promise.withResolvers();
    const writing=db.transaction(async()=>{
      await db.prepare('INSERT INTO entries VALUES(?)').run(42);
      entered.resolve();await release.promise;throw new Error('Interrompido');
    });
    await entered.promise;
    let finished=false;
    const reading=db.prepare('SELECT count(*) n FROM entries').get().then(value=>{finished=true;return value;});
    await nextTurn();assert.equal(finished,false);
    release.resolve();await assert.rejects(writing,/Interrompido/);
    assert.equal((await reading).n,0);
  }finally{db.close();}
});

test('cliente libSQL preserva duas escritas concorrentes, rollback e reabertura independente',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'hogwarts-cloud-driver-')),url='file:'+join(directory,'database.sqlite');
  let db=remoteDatabase(createClient({url,intMode:'number'}));
  try{
    await db.exec('CREATE TABLE balance(value INTEGER NOT NULL); INSERT INTO balance VALUES(0)');
    await Promise.all([1,2].map(()=>db.transaction(async()=>{
      const current=await db.prepare('SELECT value FROM balance').get();
      await db.prepare('UPDATE balance SET value=?').run(current.value+1);
    })));
    await assert.rejects(db.transaction(async()=>{await db.prepare('UPDATE balance SET value=100').run();throw new Error('Cancelar');}),/Cancelar/);
    db.close();db=remoteDatabase(createClient({url,intMode:'number'}));
    assert.equal((await db.prepare('SELECT value FROM balance').get()).value,2);
  }finally{db.close();await rm(directory,{recursive:true,force:true});}
});

test('plano privado de importação continua utilizável em outra instância após parar o servidor',async()=>{
  const f=await fixture();let other;
  try{
    const policy={audience:'ALL',characters:[],groups:[],houses:[],schoolYears:[],cohorts:[],excludedCharacters:[],regionId:null,locationId:null};
    const created=await f.master.request('/api/master/content/templates',{method:'POST',body:{payload:{title:'MODELO ENTRE INSTÂNCIAS',family:'BOOK',variant:'PARCHMENT',tone:'BRONZE',heading:'',footer:''},policy,privateNotes:''}});
    assert.equal(created.status,201);
    const pack=(await f.master.request('/api/master/archives/export')).value;pack.records=pack.records.filter(record=>record.id===created.value.id);
    const prepared=await f.master.request('/api/master/archives/prepare-import',{method:'POST',body:{package:pack,strategy:'COPY'}});
    assert.equal(prepared.status,200,JSON.stringify(prepared.value));
    await new Promise(resolve=>{f.server.close(resolve);f.server.closeAllConnections();});
    other=createApplication({...f.config,port:0});
    await new Promise(resolve=>other.server.listen(0,'127.0.0.1',resolve));
    other.config.origin='http://127.0.0.1:'+other.server.address().port;
    const apply=()=>fetch(other.config.origin+'/api/master/archives/apply',{method:'POST',headers:{Cookie:f.master.cookie,Origin:other.config.origin,'X-CSRF-Token':f.master.csrf,'Content-Type':'application/json'},body:JSON.stringify({planId:prepared.value.planId,confirmation:'IMPORTAR'})});
    const response=await apply();assert.equal(response.status,200,JSON.stringify(await response.json()));
    assert.equal(other.db.prepare("SELECT count(*) n FROM content_records WHERE kind='templates'").get().n,2);
    assert.equal((await apply()).status,409);
  }finally{
    if(other){await new Promise(resolve=>{other.server.close(resolve);other.server.closeAllConnections();});other.db.close();}
    await f.close();
  }
});

test('arquivo preparado é privado do autor, tem tamanho conferido e só pode ser consumido uma vez',async()=>{
  const f=await fixture();
  try{
    const actor=String(f.db.prepare("SELECT id FROM users WHERE role='MASTER'").get().id),id=randomUUID(),key=id+'.upload',bytes=Buffer.from('{"format":"teste"}');
    f.db.prepare('INSERT INTO archive_uploads(id,actor_id,storage_key,bytes,expires_at) VALUES(?,?,?,?,?)').run(id,actor,key,bytes.length,Date.now()+60000);
    await privateStorage(f.config).write(key,bytes,'staging');
    const db=localDatabase(f.db);
    await assert.rejects(archiveInput(db,f.config,{userId:'outra-pessoa'},{uploadId:id},1024),error=>error.status===404);
    assert.deepEqual(await archiveInput(db,f.config,{userId:actor},{uploadId:id},1024),{format:'teste'});
    await assert.rejects(archiveInput(db,f.config,{userId:actor},{uploadId:id},1024),error=>error.status===404);
    await assert.rejects(access(join(f.config.dataDir,'staging',key)));
  }finally{await f.close();}
});

test('envio direto exige Mestre real, CSRF e limite de tamanho antes de criar metadados',async()=>{
  const f=await fixture();
  try{
    f.config.storageMode='blob';f.config.storagePrefix='hogwarts-test';
    const path='/api/master/archives/uploads',options={method:'POST',body:{bytes:20}};
    assert.equal((await f.atlas.request(path,options)).status,403);
    assert.equal((await f.master.request(path,{...options,csrf:false})).status,403);
    assert.equal((await f.master.request(path+'?view_as=atlas',options)).status,403);
    assert.equal((await f.master.request(path,{method:'POST',body:{bytes:129*1024*1024}})).status,400);
    assert.equal(f.db.prepare('SELECT count(*) n FROM archive_uploads').get().n,0);
    const issued=await f.master.request(path,options);assert.equal(issued.status,201);
    assert.equal(issued.value.pathname,'hogwarts-test/staging/'+issued.value.id+'.upload');
    assert.equal((await f.atlas.request('/api/master/archives/upload-token',{method:'POST',body:{}})).status,403);
  }finally{await f.close();}
});

test('configuração remota nunca cria um banco efêmero como fallback',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'hogwarts-no-ephemeral-'));
  try{
    assert.throws(()=>createApplication({port:0,host:'127.0.0.1',origin:'https://example.invalid',secure:true,dataDir:directory,publicDir:resolve('public'),migrationsDir:resolve('migrations'),databaseMode:'turso',storageMode:'blob'}),/banco remoto/);
    await assert.rejects(access(join(directory,'hogwarts.sqlite')));
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('SDK assina apenas o destino emitido ao Mestre, com tamanho, MIME e prazo limitados',async()=>{
  const f=await fixture(),previous=process.env.BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_READ_WRITE_TOKEN='vercel_blob_rw_fixture_dummy-test-key';
  try{
    f.config.storageMode='blob';f.config.storagePrefix='hogwarts-test';
    const bundle=await f.master.request('/blob-client.js');
    assert.equal(bundle.status,200);assert.match(bundle.headers.get('content-type'),/javascript/);
    const issued=await f.master.request('/api/master/archives/uploads',{method:'POST',body:{bytes:1234}});
    const body={type:'blob.generate-client-token',payload:{pathname:issued.value.pathname,clientPayload:null,multipart:false}};
    const request=value=>f.master.request('/api/master/archives/upload-token',{method:'POST',body:value});
    assert.equal((await request({...body,payload:{...body.payload,pathname:'outro/staging/'+randomUUID()+'.upload'}})).status,400);
    assert.equal((await request({...body,payload:{...body.payload,pathname:'hogwarts-test/staging/'+randomUUID()+'.upload'}})).status,404);
    assert.equal((await request({type:body.type,payload:{}})).status,400);
    const response=await request(body);assert.equal(response.status,200);
    const signed=Buffer.from(response.value.clientToken.split('_').at(-1),'base64').toString();
    const payload=JSON.parse(Buffer.from(signed.split('.').at(-1),'base64').toString());
    assert.equal(payload.pathname,issued.value.pathname);
    assert.equal(payload.maximumSizeInBytes,1234);
    assert.deepEqual(payload.allowedContentTypes,['application/octet-stream']);
    assert.equal(payload.allowOverwrite,false);assert.equal(payload.addRandomSuffix,false);
    assert.ok(payload.validUntil>Date.now()&&payload.validUntil<=Date.now()+10*60*1000);
  }finally{
    if(previous===undefined)delete process.env.BLOB_READ_WRITE_TOKEN;else process.env.BLOB_READ_WRITE_TOKEN=previous;
    await f.close();
  }
});

test('falha na limpeza do plano confirmado preserva conteúdo e mídia e não permite replay',async()=>{
  const f=await fixture();let other;
  try{
    const image=(await f.master.request('/api/master/workshop/files',{method:'POST',body:{asset:'hogwarts_escadarias.webp'}})).value;
    const policy={audience:'ALL',characters:[],groups:[],houses:[],schoolYears:[],cohorts:[],excludedCharacters:[],regionId:null,locationId:null};
    const created=await f.master.request('/api/master/content/yearbooks',{method:'POST',body:{payload:{title:'IMPORTAÇÃO COM MÍDIA',academicYear:'1890–1891',description:'',fileId:image.id,alt:'Escadarias',articles:[],resultId:null},policy,privateNotes:''}});
    assert.equal(created.status,201);
    const pack=(await f.master.request('/api/master/archives/export')).value;pack.records=pack.records.filter(row=>row.id===created.value.id);
    const prepared=await f.master.request('/api/master/archives/prepare-import',{method:'POST',body:{package:pack,strategy:'COPY'}});
    assert.equal(prepared.status,200);
    const db=localDatabase(f.db);
    const fault={...db,prepare(sql){
      if(sql==='DELETE FROM archive_operation_plans WHERE id=?')return {run:async()=>{throw new Error('Falha temporária de limpeza');}};
      return db.prepare(sql);
    }};
    other=createApplication({...f.config,port:0},fault);
    await new Promise(resolve=>other.server.listen(0,'127.0.0.1',resolve));
    other.config.origin='http://127.0.0.1:'+other.server.address().port;
    const apply=()=>fetch(other.config.origin+'/api/master/archives/apply',{method:'POST',headers:{Cookie:f.master.cookie,Origin:other.config.origin,'X-CSRF-Token':f.master.csrf,'Content-Type':'application/json'},body:JSON.stringify({planId:prepared.value.planId,confirmation:'IMPORTAR'})});
    assert.equal((await apply()).status,200);
    const imported=f.db.prepare('SELECT draft_json FROM content_records WHERE id=?').get(prepared.value.summary.records[0].id);
    const fileId=JSON.parse(imported.draft_json).fileId;
    const file=f.db.prepare('SELECT storage_key FROM workshop_files WHERE id=?').get(fileId);
    await access(join(f.config.dataDir,'media',file.storage_key));
    assert.equal((await apply()).status,409);
  }finally{
    if(other)await new Promise(resolve=>{other.server.close(resolve);other.server.closeAllConnections();});
    await f.close();
  }
});


test('migrations da nuvem executam pelo SDK libSQL e repetição preserva os dados existentes',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'hogwarts-cloud-migrations-'));
  const db=remoteDatabase(createClient({url:'file:'+join(directory,'database.sqlite'),intMode:'number'}));
  try{
    const config={migrationsDir:resolve('migrations')};
    await migrateCloudDatabase(db,config);
    assert.equal((await db.prepare('SELECT count(*) n FROM schema_migrations').get()).n,20);
    assert.equal((await db.prepare('SELECT count(*) n FROM houses').get()).n,4);
    assert.equal((await db.prepare('SELECT count(*) n FROM characters').get()).n,5);
    assert.deepEqual(await db.prepare('PRAGMA foreign_key_check').all(),[]);
    await db.prepare('UPDATE characters SET name=? WHERE id=?').run('Nome preservado','atlas');
    await migrateCloudDatabase(db,config);
    assert.equal((await db.prepare('SELECT name FROM characters WHERE id=?').get('atlas')).name,'Nome preservado');
    assert.equal((await db.prepare('SELECT count(*) n FROM schema_migrations').get()).n,20);
  }finally{db.close();await rm(directory,{recursive:true,force:true});}
});
