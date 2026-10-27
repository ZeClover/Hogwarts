import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const exec=promisify(execFile);
test('CLI de primeiro uso aplica migrations, emite convite e gera backup consistente',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'hogwarts-cli-'));
  const env={...process.env,DATA_DIR:join(directory,'data'),APP_ORIGIN:'http://127.0.0.1:3000',NODE_ENV:'test'};
  try{
    const run=(...args)=>exec(process.execPath,['--experimental-strip-types','src/cli.ts',...args],{env});
    await run('migrate');
    const result=await run('master-invite','bootstrap@test.invalid');
    assert.match(result.stdout,/\/ativar#convite=[a-f0-9]{64}/);
    await run('backup',join(directory,'backup'));
    assert.ok((await stat(join(directory,'backup/hogwarts.sqlite'))).size>0);
    assert.ok((await stat(join(directory,'backup/media'))).isDirectory());
  }finally{await rm(directory,{recursive:true,force:true});}
});
