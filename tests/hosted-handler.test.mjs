import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import handler from '../api/index.mjs';
import {createHostedHandler} from '../dist/hosted-handler.js';
import {fixture} from './helpers.mjs';

async function serve(listener){
 const server=createServer(listener);server.listen(0,'127.0.0.1');await once(server,'listening');
 return {origin:'http://127.0.0.1:'+server.address().port,async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}

test('entrada da Vercel exporta função sem abrir banco ao importar',()=>{
 assert.equal(typeof handler,'function');
});

test('handler da Vercel inicializa uma vez e atende origem, login, cookies e CSRF pelo servidor existente',async()=>{
 const f=await fixture();let starts=0;const proxy=await serve(createHostedHandler(async()=>{starts++;return f;}));
 try{
  const contexts=await Promise.all([1,2,3].map(()=>fetch(proxy.origin+'/api/auth/context')));
  for(const response of contexts){assert.equal(response.status,200);assert.deepEqual(await response.json(),{origin:f.config.origin});}
  assert.equal(starts,1);
  const response=await fetch(proxy.origin+'/api/auth/login',{method:'POST',headers:{Origin:f.config.origin,'Content-Type':'application/json'},body:JSON.stringify({email:'master@test.invalid',password:f.password})});
  assert.equal(response.status,200);const cookie=response.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);
  const session=await fetch(proxy.origin+'/api/session',{headers:{Cookie:cookie.split(';')[0]}});assert.equal(session.status,200);assert.equal((await session.json()).role,'MASTER');
  const rejected=await fetch(proxy.origin+'/api/auth/login',{method:'POST',headers:{Origin:'https://untrusted.invalid','Content-Type':'application/json'},body:JSON.stringify({email:'master@test.invalid',password:f.password})});assert.equal(rejected.status,403);
 }finally{await proxy.close();await f.close();}
});

test('falha de inicialização responde sem segredos e permite nova tentativa no mesmo worker',async t=>{
 const f=await fixture(),entered=Promise.withResolvers(),release=Promise.withResolvers();let starts=0;const logs=[];t.mock.method(console,'error',(...args)=>logs.push(args));
 const proxy=await serve(createHostedHandler(async()=>{if(++starts===1){entered.resolve();await release.promise;throw new Error('libsql://secret-user:secret-token@private.invalid');}return f;}));
 try{
  const first=fetch(proxy.origin+'/api/auth/context');await entered.promise;release.resolve();const failed=await first;
  assert.equal(failed.status,503);assert.equal(failed.headers.get('cache-control'),'no-store');assert.equal(failed.headers.get('retry-after'),'5');assert.doesNotMatch(await failed.text(),/secret|private\.invalid/);assert.deepEqual(logs,[['HOGWARTS_STARTUP_FAILED:','Error']]);
  const recovered=await fetch(proxy.origin+'/api/auth/context');assert.equal(recovered.status,200);assert.deepEqual(await recovered.json(),{origin:f.config.origin});assert.equal(starts,2);
 }finally{release.resolve();await proxy.close();await f.close();}
});
