import { mkdtemp,readFile,readdir,writeFile,mkdir,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve,dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openDatabase } from '../dist/db.js';

const literal=value=>value===null?'NULL':typeof value==='number'?String(value):"'"+String(value).replaceAll("'","''")+"'";

// Build only from bundled migrations and a disposable canonical seed. Never
// read the campaign's database, credentials or invitations for this artifact.
export async function databaseBootstrapSQL(migrationsDir=resolve('migrations')) {
  const directory=await mkdtemp(join(tmpdir(),'hogwarts-bootstrap-'));
  let db;
  try {
    db=openDatabase({dataDir:directory,migrationsDir});
    const names=(await readdir(migrationsDir)).filter(name=>name.endsWith('.sql')).sort();
    const chunks=[
      '-- Hogwarts 1890: inicializacao de um banco libSQL NOVO e VAZIO.',
      '-- Gerado por npm run db:bootstrap-sql. Nenhum token, senha ou convite.',
      '-- Executar o lote completo em uma transacao, interrompendo em caso de erro.',
      'PRAGMA foreign_keys=ON;',
      'BEGIN IMMEDIATE;',
      'CREATE TABLE hogwarts_bootstrap_guard(empty INTEGER NOT NULL CHECK(empty=0));',
      "INSERT INTO hogwarts_bootstrap_guard SELECT count(*) FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'hogwarts_bootstrap_guard';",
      'DROP TABLE hogwarts_bootstrap_guard;',
      'CREATE TABLE schema_migrations(name TEXT PRIMARY KEY, applied_at INTEGER DEFAULT(unixepoch()));'
    ];
    for(const name of names){
      chunks.push('\n-- '+name+'\n'+await readFile(join(migrationsDir,name),'utf8'));
      chunks.push('INSERT INTO schema_migrations(name) VALUES('+literal(name)+');');
    }
    for(const name of ['houses','characters','regions','locations']){
      chunks.push('\n-- Dados canonicos: '+name);
      for(const row of db.prepare('SELECT * FROM "'+name+'" ORDER BY rowid').all()){
        const columns=Object.keys(row).filter(column=>column!=='updated_at');
        chunks.push('INSERT OR IGNORE INTO "'+name+'"('+columns.map(column=>'"'+column+'"').join(',')+') VALUES('+columns.map(column=>literal(row[column])).join(',')+');');
      }
    }
    chunks.push('COMMIT;','SELECT (SELECT count(*) FROM schema_migrations) AS migrations, (SELECT count(*) FROM houses) AS casas, (SELECT count(*) FROM characters) AS personagens;');
    return chunks.join('\n')+'\n';
  } finally {
    db?.close();
    await rm(directory,{recursive:true,force:true});
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const path=resolve(process.argv[2]??'deployment/bootstrap-empty.sql');
  await mkdir(dirname(path),{recursive:true});
  await writeFile(path,await databaseBootstrapSQL());
  console.log('SQL de inicializacao sem segredos: '+path);
}
