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
