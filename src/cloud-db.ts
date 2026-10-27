import { createClient } from '@libsql/client';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { remoteDatabase } from './async-db.ts';
import { one, transaction, type DB } from './db.ts';
import type { Config } from './config.ts';

export async function openCloudDatabase(config: Config, migrate=false): Promise<DB> {
  const url=process.env.TURSO_DATABASE_URL,authToken=process.env.TURSO_AUTH_TOKEN;
  if(!url||!authToken)throw new Error('Configure TURSO_DATABASE_URL e TURSO_AUTH_TOKEN.');
  if(!['libsql:','https:'].includes(new URL(url).protocol))throw new Error('O banco remoto exige uma conexão segura.');
  const db=remoteDatabase(createClient({url,authToken,intMode:'number'}));
  try {
    const names=(await readdir(config.migrationsDir)).filter(name=>name.endsWith('.sql')).sort();
    if(migrate){
      await migrateCloudDatabase(db,config);
    }else if(!await one(db,'SELECT name FROM schema_migrations WHERE name=?',names.at(-1)!)){
      throw new Error('Aplique as migrations antes de iniciar o portal.');
    }
    return db;
  }catch(error){db.close();throw error;}
}

export async function migrateCloudDatabase(db: DB,config: Config) {
  const names=(await readdir(config.migrationsDir)).filter(name=>name.endsWith('.sql')).sort();
  await db.exec('PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY, applied_at INTEGER DEFAULT(unixepoch()))');
  for(const name of names)if(!await one(db,'SELECT name FROM schema_migrations WHERE name=?',name)){
    const sql=await readFile(join(config.migrationsDir,name),'utf8');
    await transaction(db,async()=>{
      await db.exec(sql);
      await db.prepare('INSERT INTO schema_migrations(name) VALUES(?)').run(name);
    });
  }
  await seedCloud(db);
}

async function seedCloud(db: DB) {
  await transaction(db,async()=>{
    for(const [id,name,room] of [
      ['gryffindor','Grifinória','sala_grifinoria.webp'],['hufflepuff','Lufa-Lufa','sala_lufalufa.webp'],
      ['ravenclaw','Corvinal','sala_corvinal.webp'],['slytherin','Sonserina','sala_sonserina.webp']
    ] as const)await db.prepare('INSERT OR IGNORE INTO houses(id,name,crest,room) VALUES(?,?,?,?)').run(id,name,id+'.webp',room);
    for(const [id,name,house] of [
      ['atlas','Atlas Black','gryffindor'],['darius','Darius Gaunt','gryffindor'],['eiris','Eiris Scamander','hufflepuff'],
      ['vane','Vane Grimms','slytherin'],['drake','Drake Lovegood','ravenclaw']
    ] as const)await db.prepare('INSERT OR IGNORE INTO characters(id,name,house_id) VALUES(?,?,?)').run(id,name,house);
    await db.exec("INSERT OR IGNORE INTO regions(id,title,is_open,audience) VALUES('hogwarts','Hogwarts',1,'ALL'),('hogsmeade','Hogsmeade',0,'SELECTED')");
    for(const [id,title,image,x,y] of [
      ['tomos','Tomos e Pergaminhos','loja_tomos_pergaminhos.webp',36,85],['olivaras','Olivaras','loja_olivaras.webp',61,20],
      ['dedosdemel','Dedosdemel','loja_dedosdemel.webp',49,36],['pippin','Poções de J. Pippin','loja_pocoes.webp',31,50]
    ] as const)await db.prepare("INSERT OR IGNORE INTO locations(id,region_id,title,image,kind,x,y) VALUES(?,'hogsmeade',?,?,'SHOP',?,?)").run(id,title,image,x,y);
    await db.exec("INSERT OR IGNORE INTO locations(id,region_id,title,image,kind) VALUES('biblioteca','hogwarts','Biblioteca de Hogwarts','biblioteca_hogwarts.webp','LIBRARY')");
  });
}
