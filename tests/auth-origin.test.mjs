import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';

test('endereço de acesso é público, vem da configuração e não afrouxa origem ou CSRF',async()=>{
 const f=await fixture();try{
  const before=f.db.prepare('SELECT count(*) n FROM audit_log').get().n;
  const context=await f.client().request('/api/auth/context',{headers:{Host:'dominio-falso.test','X-Forwarded-Host':'outro-dominio.test'}});
  assert.equal(context.status,200);assert.deepEqual(context.value,{origin:f.config.origin});assert.match(context.headers.get('cache-control'),/no-store/);assert.equal(context.headers.get('access-control-allow-origin'),null);
  const guest=f.client(),sessions=f.db.prepare('SELECT count(*) n FROM sessions').get().n;
  assert.equal((await guest.request('/api/auth/login',{method:'POST',headers:{Origin:'https://outro-dominio.test'},body:{email:'atlas@test.invalid',password:f.password}})).status,403);
  assert.equal(f.db.prepare('SELECT count(*) n FROM sessions').get().n,sessions);
  assert.equal((await f.atlas.request('/api/profile',{method:'PATCH',body:{biography:'Não salvar'},csrf:false})).status,403);
  assert.equal(f.db.prepare('SELECT count(*) n FROM audit_log').get().n,before);
 }finally{await f.close();}
});
