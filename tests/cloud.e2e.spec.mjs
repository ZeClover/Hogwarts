import { test,expect } from '@playwright/test';
import { fixture } from './helpers.mjs';
import { privateStorage } from '../dist/storage.js';

// The browser runs the real bundled SDK and the real token/prepare/apply routes.
// Only the provider's PUT is replaced, with bytes staged in the private fixture.
test('envio direto usa SDK local, token limitado e revisão real antes de importar',async({page})=>{
  const f=await fixture(),previous=process.env.BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_READ_WRITE_TOKEN='vercel_blob_rw_fixture_dummy-test-key';
  try{
    const pack=(await f.master.request('/api/master/archives/export')).value;
    const count=f.db.prepare('SELECT count(*) n FROM content_records').get().n;
    f.config.storageMode='blob';f.config.storagePrefix='hogwarts-browser-test';
    let uploaded=false;
    await page.route('https://vercel.com/api/blob/**',async route=>{
      const req=route.request();
      const headers={'Access-Control-Allow-Origin':f.config.origin,'Access-Control-Allow-Methods':'PUT, OPTIONS','Access-Control-Allow-Headers':'*'};
      if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
      expect(req.method()).toBe('PUT');
      const pathname=new URL(req.url()).searchParams.get('pathname');
      const row=f.db.prepare('SELECT storage_key FROM archive_uploads').get();
      expect(pathname).toBe('hogwarts-browser-test/staging/'+row.storage_key);
      expect(req.headers().authorization).toMatch(/^Bearer vercel_blob_client_/);
      await privateStorage({...f.config,storageMode:'local'}).write(row.storage_key,req.postDataBuffer(),'staging');
      f.config.storageMode='local';uploaded=true;
      await route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify({url:'https://fixture.private.blob.vercel-storage.com/'+pathname,downloadUrl:'https://fixture.private.blob.vercel-storage.com/'+pathname,pathname,contentType:'application/octet-stream',contentDisposition:'attachment',etag:'fixture'})});
    });
    await page.goto(f.config.origin+'/entrar');
    await page.getByLabel('E-mail',{exact:true}).fill('master@test.invalid');
    await page.getByLabel('Senha',{exact:true}).fill(f.password);
    await page.getByRole('button',{name:'Entrar nos arquivos'}).click();
    await expect(page.locator('.top')).toBeVisible();
    await page.goto(f.config.origin+'/portal/mestre/arquivos');
    await page.getByLabel('IDs já existentes na importação',{exact:true}).selectOption('COPY');
    await page.getByLabel('Arquivo privado',{exact:true}).setInputFiles({name:'conteudos.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(pack))});
    await page.getByRole('button',{name:'Analisar sem aplicar',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Resultado da revisão',exact:true})).toBeVisible();
    expect(uploaded).toBe(true);
    expect(f.db.prepare('SELECT count(*) n FROM content_records').get().n).toBe(count);
    expect(f.db.prepare('SELECT count(*) n FROM archive_uploads').get().n).toBe(0);
    await page.getByLabel('Digite IMPORTAR para confirmar',{exact:true}).fill('IMPORTAR');
    await page.getByRole('button',{name:'Aplicar operação revisada',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Resultado da revisão',exact:true})).toHaveCount(0);
    expect(f.db.prepare('SELECT count(*) n FROM content_records').get().n).toBe(count*2);
  }finally{
    if(previous===undefined)delete process.env.BLOB_READ_WRITE_TOKEN;else process.env.BLOB_READ_WRITE_TOKEN=previous;
    await page.close();await f.close();
  }
});
