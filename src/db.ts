import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, readFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import type { Config } from './config.ts';

export type Row = Record<string, string | number | null>;
export type DB = DatabaseSync;
export function openDatabase(config: Config): DB {
  mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
  mkdirSync(join(config.dataDir, 'media'), { recursive: true, mode: 0o700 });
  const file = join(config.dataDir, 'hogwarts.sqlite');
  const db = new DatabaseSync(file);
  chmodSync(file, 0o600);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY, applied_at INTEGER DEFAULT(unixepoch()))');
  for (const name of readdirSync(config.migrationsDir).filter(x => x.endsWith('.sql')).sort()) {
    if (!db.prepare('SELECT name FROM schema_migrations WHERE name=?').get(name)) {
      transaction(db, () => {
        db.exec(readFileSync(join(config.migrationsDir, name), 'utf8'));
        db.prepare('INSERT INTO schema_migrations(name) VALUES(?)').run(name);
      });
    }
  }
  seed(db);
  return db;
}
export function transaction<T>(db: DB, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try { const result = fn(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
export function one(db: DB, sql: string, ...args: (string | number | null)[]): Row | undefined {
  return db.prepare(sql).get(...args) as Row | undefined;
}
export function all(db: DB, sql: string, ...args: (string | number | null)[]): Row[] {
  return db.prepare(sql).all(...args) as Row[];
}
export function audit(db: DB, actor: string | null, action: string, type: string, target: string, details = {}) {
  db.prepare('INSERT INTO audit_log(actor_id,action,target_type,target_id,details) VALUES(?,?,?,?,?)')
    .run(actor, action, type, target, JSON.stringify(details));
}
function seed(db: DB) {
  transaction(db, () => {
    for (const [id, name, room] of [
      ['gryffindor', 'Grifinória', 'sala_grifinoria.webp'], ['hufflepuff', 'Lufa-Lufa', 'sala_lufalufa.webp'],
      ['ravenclaw', 'Corvinal', 'sala_corvinal.webp'], ['slytherin', 'Sonserina', 'sala_sonserina.webp']
    ]) db.prepare('INSERT OR IGNORE INTO houses(id,name,crest,room) VALUES(?,?,?,?)').run(id!, name!, `${id}.webp`, room!);
    for (const [id, name, house] of [
      ['atlas','Atlas Black','gryffindor'], ['darius','Darius Gaunt','gryffindor'], ['eiris','Eiris Scamander','hufflepuff'],
      ['vane','Vane Grimms','slytherin'], ['drake','Drake Lovegood','ravenclaw']
    ]) db.prepare('INSERT OR IGNORE INTO characters(id,name,house_id) VALUES(?,?,?)').run(id!,name!,house!);
    db.prepare("INSERT OR IGNORE INTO regions(id,title,is_open,audience) VALUES('hogwarts','Hogwarts',1,'ALL'),('hogsmeade','Hogsmeade',0,'SELECTED')").run();
    for (const [id,title,image,x,y] of [
      ['tomos','Tomos e Pergaminhos','loja_tomos_pergaminhos.webp',36,85],
      ['olivaras','Olivaras','loja_olivaras.webp',61,20],
      ['dedosdemel','Dedosdemel','loja_dedosdemel.webp',49,36],
      ['pippin','Poções de J. Pippin','loja_pocoes.webp',31,50]
    ] as const) db.prepare("INSERT OR IGNORE INTO locations(id,region_id,title,image,kind,x,y) VALUES(?,'hogsmeade',?,?,'SHOP',?,?)").run(id,title,image,x,y);
    db.prepare("INSERT OR IGNORE INTO locations(id,region_id,title,image,kind) VALUES('biblioteca','hogwarts','Biblioteca de Hogwarts','biblioteca_hogwarts.webp','LIBRARY')").run();
  });
}
