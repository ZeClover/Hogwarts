import { hostedConfiguration } from './hosted-config.ts';
import { openCloudDatabase } from './cloud-db.ts';
import { createApplication } from './server.ts';
import { StartupProblem } from './startup-problem.ts';

export async function createHostedApplication() {
  const config=hostedConfiguration();
  let db;try{db=await openCloudDatabase(config);}catch(error){
    if(error instanceof Error&&(error.message==='Aplique as migrations antes de iniciar o portal.'||/no such table: schema_migrations/.test(error.message)))throw new StartupProblem('DATABASE_MIGRATIONS','O banco da campanha precisa ser atualizado antes do acesso.');
    throw new StartupProblem('DATABASE_CONNECTION','Não foi possível conectar ao banco da campanha.');
  }
  try{return createApplication(config,db);}catch{db.close();throw new StartupProblem('APPLICATION_INITIALIZATION','Não foi possível iniciar a aplicação da campanha.');}
}
