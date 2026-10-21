import { backup } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync, cpSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { configuration } from './config.ts';
import { openDatabase, one, transaction, audit } from './db.ts';
import { token, digest, email, now } from './auth.ts';

const config = configuration();
const db = openDatabase(config);
try {
  const command = process.argv[2];
  if (command === 'migrate') console.log('Migrations aplicadas. Cinco personagens confirmados disponíveis.');
  else if (command === 'master-invite') {
    const address = email(process.argv[3]);
    if (one(db,"SELECT id FROM users WHERE role='MASTER'")) throw new Error('Já existe um Mestre. Crie convites pela Central do Mestre.');
    const raw = token(), id = randomUUID();
    transaction(db,()=>{
      db.prepare("UPDATE invites SET revoked_at=? WHERE role='MASTER' AND used_at IS NULL AND revoked_at IS NULL").run(now());
      db.prepare("INSERT INTO invites(id,token_hash,email,role,expires_at) VALUES(?,?,?,'MASTER',?)").run(id,digest(raw),address,now()+3600);
      audit(db,null,'BOOTSTRAP_INVITE','INVITE',id);
    });
    console.log(`Convite inicial do Mestre (expira em 1 hora; mantenha privado):\n${config.origin}/ativar#convite=${raw}`);
  } else if (command === 'backup') {
    const directory = resolve(process.argv[3] ?? `backups/${new Date().toISOString().replace(/[:.]/g,'-')}`);
    // Requests must be stopped so the DB and private media form one consistent snapshot.
    mkdirSync(directory,{recursive:true,mode:0o700});
    await backup(db,join(directory,'hogwarts.sqlite'));
    cpSync(join(config.dataDir,'media'),join(directory,'media'),{recursive:true});
    console.log(`Backup privado: ${directory}`);
  } else throw new Error('Use migrate, master-invite email@exemplo.com ou backup [diretório].');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha no comando.');
  process.exitCode = 1;
} finally { db.close(); }
