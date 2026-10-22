import { configuration } from './config.ts';

export function hostedConfiguration(){
  for(const name of ['APP_ORIGIN','TURSO_DATABASE_URL','TURSO_AUTH_TOKEN','BACKUP_ENCRYPTION_KEY','HOGWARTS_STORAGE_PREFIX']) {
    if(!process.env[name])throw new Error(`Configure ${name} antes de publicar.`);
  }
  if(!process.env.BLOB_READ_WRITE_TOKEN)throw new Error('Configure BLOB_READ_WRITE_TOKEN para o Vercel Blob privado e os envios diretos.');
  if(Buffer.from(process.env.BACKUP_ENCRYPTION_KEY!,'base64').length!==32)throw new Error('BACKUP_ENCRYPTION_KEY precisa conter 32 bytes em base64.');
  if(!/^[a-z0-9][a-z0-9/_-]{0,100}$/.test(process.env.HOGWARTS_STORAGE_PREFIX!))throw new Error('Prefixo de arquivos inválido.');
  const config=configuration();
  if(config.databaseMode!=='turso'||config.storageMode!=='blob'||!config.secure)throw new Error('A hospedagem exige banco remoto, arquivos privados e HTTPS.');
  return config;
}
