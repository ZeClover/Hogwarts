import { DatabaseSync } from 'node:sqlite';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { localDatabase, type Row } from './async-db.ts';
import type { Config } from './config.ts';

// This is a disposable validation copy, never the campaign's persistence.
// Only migrations from the application are executed, never uploaded SQL.
export async function validationDatabase(config: Config,state: Record<string,Row[]>) {
  const raw=new DatabaseSync(':memory:');
  try{
    raw.exec('PRAGMA foreign_keys=OFF; CREATE TABLE schema_migrations(name TEXT PRIMARY KEY, applied_at INTEGER DEFAULT(unixepoch()))');
    for(const name of (await readdir(config.migrationsDir)).filter(name=>name.endsWith('.sql')).sort())raw.exec(await readFile(join(config.migrationsDir,name),'utf8'));
    const names=new Set(raw.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(row=>String(row.name)));
    raw.exec('BEGIN');
    for(const name of names)raw.exec(`DELETE FROM "${name}"`);
    for(const [name,rows] of Object.entries(state)){
      if(!names.has(name))throw new Error('A estrutura da campanha difere das migrations.');
      const columns=new Set(raw.prepare(`PRAGMA table_info("${name}")`).all().map(row=>String(row.name)));
      for(const row of rows){
        const keys=Object.keys(row);
        if(keys.some(key=>!columns.has(key)))throw new Error('Colunas de campanha incompatíveis.');
        raw.prepare(`INSERT INTO "${name}"(${keys.map(key=>'"'+key+'"').join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...keys.map(key=>row[key]??null));
      }
    }
    raw.exec('COMMIT; PRAGMA foreign_keys=ON');
    return localDatabase(raw);
  }catch(error){raw.close();throw error;}
}

// Upgrade a decrypted backup only through this application's known migrations.
// No SQL is accepted from the backup. The live database is never modified here.
export async function upgradeBackupState(config:Config, schema:string, state:Record<string,Row[]>) {
 const names=(await readdir(config.migrationsDir)).filter(n=>n.endsWith('.sql')).sort();
 const saved=(state.schema_migrations??[]).map(r=>String(r.name)).sort();
 if(!saved.length||saved.length>=names.length||saved.some((n,i)=>n!==names[i]))throw Error('Migrations incompatíveis.');
 const raw=new DatabaseSync(':memory:');
 try{
  raw.exec('CREATE TABLE schema_migrations(name TEXT PRIMARY KEY, applied_at INTEGER DEFAULT(unixepoch()))');
  for(const name of saved)raw.exec(await readFile(join(config.migrationsDir,name),'utf8'));
  const {createHash}=await import('node:crypto');
  const definitions=()=>raw.prepare("SELECT name,sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const schemaOf=()=>createHash('sha256').update(JSON.stringify(definitions())).digest('hex');
  if(schemaOf()!==schema)throw Error('Estrutura original incompatível.');
  const tables=definitions().map(r=>String(r.name));
  if(Object.keys(state).sort().join()!==[...tables].sort().join())throw Error('Backup incompleto.');
  raw.exec('PRAGMA foreign_keys=OFF; BEGIN');
  for(const table of tables){
   raw.exec(`DELETE FROM "${table}"`);
   const columns=raw.prepare(`PRAGMA table_info("${table}")`).all().map(r=>String(r.name)).sort();
   for(const row of state[table]??[]){const keys=Object.keys(row).sort();if(keys.join()!==columns.join()||Object.values(row).some(v=>v!==null&&typeof v!=='string'&&typeof v!=='number'))throw Error('Colunas inválidas.');raw.prepare(`INSERT INTO "${table}"(${keys.map(k=>'"'+k+'"').join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...keys.map(k=>row[k]??null));}
  }
  raw.exec('COMMIT; PRAGMA foreign_keys=ON');
  if(raw.prepare('PRAGMA foreign_key_check').all().length)throw Error('Referências inválidas.');
  for(const name of names.slice(saved.length)){raw.exec('BEGIN');raw.exec(await readFile(join(config.migrationsDir,name),'utf8'));raw.prepare('INSERT INTO schema_migrations(name) VALUES(?)').run(name);raw.exec('COMMIT');}
  if(raw.prepare('PRAGMA foreign_key_check').all().length)throw Error('Migração inválida.');
  return {schema:schemaOf(),tables:Object.fromEntries(definitions().map(r=>[String(r.name),raw.prepare(`SELECT * FROM "${r.name}" ORDER BY rowid`).all()]))} as {schema:string;tables:Record<string,Row[]>};
 }finally{raw.close();}
}
