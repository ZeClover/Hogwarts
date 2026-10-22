import { spawnSync } from 'node:child_process';
import { globSync } from 'node:fs';

const result=spawnSync(process.execPath,['--test',...globSync('tests/*.test.mjs')],{
  env:{...process.env,TEST_DB_BACKEND:'libsql'},stdio:'inherit'
});
process.exitCode=result.status??1;
