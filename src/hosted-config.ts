import { configuration } from './config.ts';
import { StartupProblem } from './startup-problem.ts';

export function hostedConfiguration(){
  const missing=['APP_ORIGIN','TURSO_DATABASE_URL','TURSO_AUTH_TOKEN','BACKUP_ENCRYPTION_KEY','HOGWARTS_STORAGE_PREFIX','BLOB_READ_WRITE_TOKEN'].filter(name=>!process.env[name]);
  if(missing.length)throw new StartupProblem('CONFIGURATION_MISSING','A configuração da hospedagem está incompleta.',missing);
  if(Buffer.from(process.env.BACKUP_ENCRYPTION_KEY!,'base64').length!==32)throw new StartupProblem('CONFIGURATION_INVALID','A chave de backup da hospedagem é inválida.');
  if(!/^[a-z0-9][a-z0-9/_-]{0,100}$/.test(process.env.HOGWARTS_STORAGE_PREFIX!))throw new StartupProblem('CONFIGURATION_INVALID','O prefixo de arquivos da hospedagem é inválido.');
  let config;try{config=configuration();}catch{throw new StartupProblem('CONFIGURATION_INVALID','O endereço principal da hospedagem é inválido.');}
  if(config.databaseMode!=='turso'||config.storageMode!=='blob'||!config.secure)throw new StartupProblem('CONFIGURATION_INVALID','A hospedagem exige banco remoto, arquivos privados e HTTPS.');
  return config;
}
