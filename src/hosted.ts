import { hostedConfiguration } from './hosted-config.ts';
import { openCloudDatabase } from './cloud-db.ts';
import { createApplication } from './server.ts';

export async function createHostedApplication() {
  const config=hostedConfiguration();
  const db=await openCloudDatabase(config);
  return createApplication(config,db);
}
