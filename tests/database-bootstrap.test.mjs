import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { createClient } from '@libsql/client';
import { databaseBootstrapSQL } from '../scripts/database-bootstrap.mjs';
import { openDatabase } from '../dist/db.js';
import { remoteDatabase } from '../dist/async-db.js';
import { migrateCloudDatabase } from '../dist/cloud-db.js';

const schemaSQL="SELECT name,sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name";

test('SQL publicado inicializa exatamente a estrutura do app pelo cliente libSQL',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'hogwarts-bootstrap-test-'));
  const baseline=openDatabase({dataDir:join(directory,'canonical'),migrationsDir:resolve('migrations')});
  const db=remoteDatabase(createClient({url:'file:'+join(directory,'bootstrap.sqlite'),intMode:'number'}));
  try {
    const sql=await databaseBootstrapSQL();
    assert.equal(await readFile('deployment/bootstrap-empty.sql','utf8'),sql,'Regere o arquivo com npm run db:bootstrap-sql.');
    await db.exec(sql);
    assert.deepEqual(await db.prepare(schemaSQL).all(),baseline.prepare(schemaSQL).all().map(row=>({...row})));
    await migrateCloudDatabase(db,{migrationsDir:resolve('migrations')});
    for(const table of ['schema_migrations','houses','characters','regions','locations','content_records','users','invites']){
      assert.equal((await db.prepare(`SELECT count(*) n FROM "${table}"`).get()).n,baseline.prepare(`SELECT count(*) n FROM "${table}"`).get().n);
    }
    assert.deepEqual(await db.prepare('PRAGMA foreign_key_check').all(),[]);
  } finally {db.close();baseline.close();await rm(directory,{recursive:true,force:true});}
});

test('SQL de primeira instalacao recusa banco existente e preserva dados apos rollback',async()=>{
  const sql=await databaseBootstrapSQL();
  for(const initialized of [false,true]){
    const db=new DatabaseSync(':memory:');
    try {
      if(initialized)db.exec(sql);
      db.exec("CREATE TABLE existing_campaign(note TEXT); INSERT INTO existing_campaign VALUES('preservar')");
      const before=db.prepare(schemaSQL).all();
      assert.throws(()=>db.exec(sql),/CHECK constraint failed/);
      db.exec('ROLLBACK');
      assert.deepEqual(db.prepare(schemaSQL).all(),before);
      assert.equal(db.prepare('SELECT note FROM existing_campaign').get().note,'preservar');
    } finally {db.close();}
  }
});

test('SQL do Studio usa transacao do executor e preserva estrutura, seed e gatilhos',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'hogwarts-studio-test-'));
  const baseline=openDatabase({dataDir:join(directory,'canonical'),migrationsDir:resolve('migrations')});
  const client=createClient({url:'file:'+join(directory,'studio.sqlite'),intMode:'number'});
  const tx=await client.transaction('write');
  try {
    const sql=await databaseBootstrapSQL(resolve('migrations'),{studio:true});
    assert.equal(await readFile('deployment/bootstrap-studio.sql','utf8'),sql);
    assert.doesNotMatch(sql,/^\s*(?:BEGIN|COMMIT|ROLLBACK|PRAGMA)\b/gm);
    await tx.executeMultiple(sql);
    await tx.commit();
    const schema="SELECT type,name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name";
    assert.deepEqual((await client.execute(schema)).rows.map(row=>({...row})),baseline.prepare(schema).all().map(row=>({...row})));
    const counts=(await client.execute('SELECT (SELECT count(*) FROM schema_migrations) migrations,(SELECT count(*) FROM houses) casas,(SELECT count(*) FROM characters) personagens,(SELECT count(*) FROM content_records) content')).rows[0];
    assert.deepEqual({...counts},{migrations:22,casas:4,personagens:5,content:baseline.prepare('SELECT count(*) n FROM content_records').get().n});
    await client.execute("INSERT INTO regions(id,title,audience) VALUES('studio-test','Teste','ALL')");
    assert.equal((await client.execute("SELECT kind FROM content_records WHERE id='studio-test'")).rows[0].kind,'regions');
    assert.deepEqual((await client.execute('PRAGMA foreign_key_check')).rows,[]);
  } finally {tx.close();client.close();baseline.close();await rm(directory,{recursive:true,force:true});}
});

test('lote do Studio recusa tabelas existentes e o executor desfaz a tentativa',async()=>{
  const client=createClient({url:':memory:'});
  try {
    await client.execute('CREATE TABLE campaign(note TEXT)');
    await client.execute("INSERT INTO campaign VALUES('preservar')");
    const tx=await client.transaction('write');
    try {
      await assert.rejects(tx.executeMultiple(await databaseBootstrapSQL(resolve('migrations'),{studio:true})),/CHECK constraint failed/);
      await tx.rollback();
    } finally {tx.close();}
    assert.deepEqual((await client.execute("SELECT name FROM sqlite_schema WHERE type='table'")).rows.map(row=>row.name),['campaign']);
    assert.equal((await client.execute('SELECT note FROM campaign')).rows[0].note,'preservar');
  } finally {client.close();}
});
