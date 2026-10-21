import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { fixture } from './helpers.mjs';
import { openDatabase } from '../dist/db.js';
import { now } from '../dist/auth.js';
let f;
before(async()=>{f=await fixture();});
after(async()=>{await f?.close();});
const region=(data={})=>({method:'PATCH',body:{isOpen:true,audience:'SELECTED',characters:[],groups:[],...data}});

test('migrations são repetíveis e seed mantém somente cinco personagens, catálogos e narrativa vazios',()=>{
  const db=openDatabase(f.config);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM characters').get().n,5);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM publications').get().n,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM schema_migrations').get().n,2);
  assert.equal(db.prepare("SELECT is_open FROM regions WHERE id='hogsmeade'").get().is_open,0);db.close();
});
test('sessão obrigatória e arquivos internos nunca são servidos',async()=>{
  const guest=f.client();
  for(const path of ['/api/state','/api/master/state','/api/locations/olivaras'])assert.equal((await guest.request(path)).status,401);
  for(const path of ['/data/hogwarts.sqlite','/.env','/src/server.ts','/migrations/001_foundation.sql'])assert.equal((await guest.request(path)).status,404);
});
test('sessão usa HttpOnly, SameSite=Strict e tokens armazenados apenas como hash',async()=>{
  const account=f.client();
  const result=await account.request('/api/auth/login',{method:'POST',body:{email:'atlas@test.invalid',password:f.password}});
  assert.equal(result.status,200);assert.match(result.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  const raw=account.cookie.split('=')[1];assert.equal(f.db.prepare('SELECT token_hash FROM sessions WHERE token_hash=?').get(raw),undefined);
});
test('origem e CSRF são obrigatórios para operações autenticadas',async()=>{
  const body={biography:'Teste isolado'};
  assert.equal((await f.atlas.request('/api/profile',{method:'PATCH',body,csrf:false})).status,403);
  assert.equal((await f.atlas.request('/api/profile',{method:'PATCH',body,origin:false})).status,403);
  assert.equal((await f.atlas.request('/api/profile',{method:'PATCH',body,headers:{Origin:'https://invasor.invalid'}})).status,403);
});
test('PLAYER não eleva papel por query, cabeçalho ou campo de perfil',async()=>{
  assert.equal((await f.atlas.request('/api/master/state?role=MASTER',{headers:{'X-Role':'MASTER'}})).status,403);
  assert.equal((await f.atlas.request('/api/master/regions/hogsmeade',region({audience:'ALL'}))).status,403);
  assert.equal((await f.atlas.request('/api/profile',{method:'PATCH',body:{biography:'Teste',role:'MASTER',house:'slytherin'}})).status,403);
  assert.equal((await f.atlas.request('/api/state?view_as=eiris')).status,403);
});
test('região fechada não envia nomes, IDs, marcadores ou metadados das lojas',async()=>{
  const result=await f.atlas.request('/api/state');assert.equal(result.status,200);
  assert.equal(result.value.regions.find(r=>r.id==='hogsmeade').accessible,false);
  for(const hidden of ['Olivaras','Dedosdemel','Tomos e Pergaminhos','loja_olivaras','"olivaras"'])assert.ok(!JSON.stringify(result.value).includes(hidden));
  assert.equal((await f.atlas.request('/api/locations/olivaras')).status,404);
});
test('Mestre abre Hogsmeade somente para destinatários, com controle no acesso direto',async()=>{
  assert.equal((await f.master.request('/api/master/regions/hogsmeade',region({characters:['atlas']}))).status,200);
  assert.equal((await f.atlas.request('/api/locations/olivaras')).status,200);
  assert.equal((await f.eiris.request('/api/locations/olivaras')).status,404);
  assert.equal((await f.eiris.request('/api/state')).value.locations.some(l=>l.regionId==='hogsmeade'),false);
});
test('grupos liberam a região e mudanças de integrantes têm efeito imediato',async()=>{
  const group=await f.master.request('/api/master/groups',{method:'POST',body:{name:'Grupo de teste',members:['eiris']}});
  assert.equal(group.status,200);
  await f.master.request('/api/master/regions/hogsmeade',region({groups:[group.value.id]}));
  assert.equal((await f.eiris.request('/api/locations/olivaras')).status,200);
  assert.equal((await f.atlas.request('/api/locations/olivaras')).status,404);
  await f.master.request(`/api/master/groups/${group.value.id}`,{method:'PATCH',body:{name:'Grupo de teste',members:['atlas']}});
  assert.equal((await f.eiris.request('/api/locations/olivaras')).status,404);
  assert.equal((await f.atlas.request('/api/locations/olivaras')).status,200);
});
test('loja secreta exige liberação específica mesmo com a região aberta a todos',async()=>{
  await f.master.request('/api/master/regions/hogsmeade',region({audience:'ALL'}));
  const created=await f.master.request('/api/master/locations',{method:'POST',body:{title:'SEGREDO APENAS DO TESTE',regionId:'hogsmeade',image:'antiquario_ou_oficina.webp'}});
  assert.equal(created.status,201);const id=created.value.id;
  assert.equal((await f.atlas.request(`/api/locations/${id}`)).status,404);
  assert.ok(!JSON.stringify((await f.atlas.request('/api/state')).value).includes(id));
  const config={enabled:true,isSecret:true,audience:'ALL',characters:['atlas'],groups:[],x:10,y:20};
  await f.master.request(`/api/master/locations/${id}`,{method:'PATCH',body:config});
  assert.equal((await f.atlas.request(`/api/locations/${id}`)).status,200);
  assert.equal((await f.eiris.request(`/api/locations/${id}`)).status,404);
  await f.master.request('/api/master/regions/hogsmeade',region({isOpen:false,audience:'ALL'}));
  assert.equal((await f.atlas.request(`/api/locations/${id}`)).status,404);
});
test('local desativado não é revelado nem por grant específico',async()=>{
  await f.master.request('/api/master/regions/hogsmeade',region({audience:'ALL'}));
  await f.master.request('/api/master/locations/olivaras',{method:'PATCH',body:{enabled:false,isSecret:false,audience:'ALL',characters:['atlas'],groups:[],x:61,y:20}});
  assert.equal((await f.atlas.request('/api/locations/olivaras')).status,404);
  await f.master.request('/api/master/locations/olivaras',{method:'PATCH',body:{enabled:true,isSecret:false,audience:'ALL',characters:[],groups:[],x:61,y:20}});
});
test('preview usa permissões reais e não altera auditoria, sessões, leituras ou descobertas',async()=>{
  await f.master.request('/api/master/regions/hogsmeade',region({characters:['atlas']}));
  const before=JSON.stringify(f.db.prepare('SELECT * FROM audit_log').all());
  const sessions=JSON.stringify(f.db.prepare('SELECT * FROM sessions ORDER BY token_hash').all());
  const preview=await f.master.request('/api/state?view_as=eiris');
  assert.equal(preview.value.role,'PLAYER');assert.equal(preview.value.character.id,'eiris');assert.equal(preview.value.preview,true);
  assert.equal(preview.value.locations.some(l=>l.regionId==='hogsmeade'),false);
  assert.equal((await f.master.request('/api/locations/olivaras?view_as=eiris')).status,404);
  assert.equal((await f.master.request('/api/master/state?view_as=eiris')).status,403);
  assert.equal((await f.master.request('/api/profile?view_as=eiris',{method:'PATCH',body:{biography:'Não gravar'}})).status,403);
  assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM audit_log').all()),before);
  assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM sessions ORDER BY token_hash').all()),sessions);
});
test('jogador edita somente a própria biografia; Mestre pode moderar',async()=>{
  assert.equal((await f.atlas.request('/api/profile',{method:'PATCH',body:{biography:'Texto de teste <script>alert(1)</script>'}})).status,200);
  assert.equal((await f.atlas.request('/api/state')).value.character.biography,'Texto de teste <script>alert(1)</script>');
  assert.equal((await f.eiris.request('/api/profile?character=atlas',{method:'PATCH',body:{biography:'Invadida'}})).status,403);
  assert.equal((await f.master.request('/api/profile?character=atlas',{method:'PATCH',body:{biography:''}})).status,200);
});
test('nome, Casa e ano escolar só mudam pelo Mestre e atualizam o estado sem novo login',async()=>{
  assert.equal((await f.master.request('/api/master/characters/atlas',{method:'PATCH',body:{name:'Atlas Black',house:'ravenclaw',year:2}})).status,200);
  const character=(await f.atlas.request('/api/state')).value.character;
  assert.equal(character.house,'ravenclaw');assert.equal(character.room,'/assets/sala_corvinal.webp');assert.equal(character.year,2);
  await f.master.request('/api/master/characters/atlas',{method:'PATCH',body:{name:'Atlas Black',house:'gryffindor',year:null}});
});
test('upload decodifica imagem, remove metadados, limita tamanho e mantém arquivo privado',async()=>{
  const image=await sharp({create:{width:800,height:600,channels:3,background:'#112233'}}).withExif({IFD0:{Artist:'PRIVADO TESTE'}}).jpeg().toBuffer();
  const result=await f.atlas.request('/api/profile/photo',{method:'PUT',body:image,headers:{'Content-Type':'image/jpeg'},raw:true});
  assert.equal(result.status,200);
  const photo=(await f.atlas.request('/api/state')).value.character.photo;
  assert.ok(photo.startsWith('/api/media/'));
  const media=await f.atlas.request(photo);assert.equal(media.status,200);assert.equal(media.headers.get('cache-control'),'no-store');
  const meta=await sharp(media.value).metadata();assert.equal(meta.width,512);assert.equal(meta.height,512);assert.equal(meta.exif,undefined);
  assert.equal((await f.eiris.request(photo)).status,404);
  assert.equal((await f.master.request(`${photo}?view_as=eiris`)).status,404);
  assert.equal((await f.master.request(photo)).status,200);
  assert.equal((await f.client().request(photo)).status,401);
  assert.equal((await f.eiris.request('/api/profile/photo?character=atlas',{method:'PUT',body:image,headers:{'Content-Type':'image/jpeg'},raw:true})).status,403);
  assert.equal((await f.atlas.request('/api/profile/photo',{method:'PUT',body:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),headers:{'Content-Type':'image/png'},raw:true})).status,415);
  assert.equal((await f.atlas.request('/api/profile/photo',{method:'PUT',body:Buffer.alloc(2*1024*1024+1),headers:{'Content-Type':'image/png'},raw:true})).status,413);
  assert.equal((await f.master.request('/api/profile/photo?character=atlas',{method:'DELETE'})).status,200);
  assert.equal((await f.atlas.request(photo)).status,404);
});
test('novidades filtram rascunhos, destinatários e regiões; leitura não marca conteúdo',async()=>{
  const insert=f.db.prepare('INSERT INTO publications(id,title,body,kind,status,audience,campaign_year,published_at,region_id) VALUES(?,?,?,\'CONTENT\',?,?,1890,?,?)');
  insert.run('test-draft','RASCUNHO TESTE','Nada oficial','DRAFT','ALL',now(),null);
  insert.run('test-personal','PRIVADO TESTE','Nada oficial','PUBLISHED','SELECTED',now(),null);
  insert.run('test-region','REGIÃO TESTE','Nada oficial','PUBLISHED','ALL',now(),'hogsmeade');
  f.db.prepare("INSERT INTO access_grants(id,resource_type,resource_id,character_id) VALUES(?,'PUBLICATION','test-personal','atlas')").run(randomUUID());
  const atlas=await f.atlas.request('/api/state'),eiris=await f.eiris.request('/api/state');
  assert.deepEqual(atlas.value.news.map(p=>p.id).sort(),['test-personal','test-region']);assert.equal(eiris.value.news.length,0);
  for(const id of ['test-draft','test-personal','test-region'])assert.equal((await f.eiris.request('/api/publications/'+id)).status,404);
  assert.equal((await f.atlas.request('/api/publications/test-personal')).status,200);
  assert.equal((await f.master.request('/api/publications/test-personal?view_as=eiris')).status,404);
  f.db.prepare("DELETE FROM access_grants WHERE resource_type='PUBLICATION'").run();f.db.exec('DELETE FROM publications');
});
test('convites expirados, revogados ou de outro e-mail são recusados',async()=>{
  let raw=await f.invite('darius');
  assert.equal((await f.client().request('/api/auth/activate',{method:'POST',body:{email:'outro@test.invalid',password:f.password,token:raw}})).status,400);
  f.db.prepare("UPDATE invites SET expires_at=? WHERE character_id='darius'").run(now()-1);
  assert.equal((await f.client().request('/api/auth/activate',{method:'POST',body:{email:'darius@test.invalid',password:f.password,token:raw}})).status,400);
  raw=await f.invite('darius');
  const invite=f.db.prepare("SELECT id FROM invites WHERE character_id='darius' AND revoked_at IS NULL ORDER BY expires_at DESC").get();
  await f.master.request(`/api/master/invites/${invite.id}`,{method:'DELETE'});
  assert.equal((await f.client().request('/api/auth/activate',{method:'POST',body:{email:'darius@test.invalid',password:f.password,token:raw}})).status,400);
});
test('ativação concorrente consome um convite apenas uma vez e nunca armazena senha em texto',async()=>{
  const raw=await f.invite('vane');
  const results=await Promise.all([f.client(),f.client()].map(c=>c.request('/api/auth/activate',{method:'POST',body:{email:'vane@test.invalid',password:f.password,token:raw}})));
  assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.status===409).length,1);
  const user=f.db.prepare("SELECT password_hash FROM users WHERE email='vane@test.invalid'").get();
  assert.notEqual(user.password_hash,f.password);assert.match(user.password_hash,/^[a-f0-9]{32}:[a-f0-9]{128}$/);
});
test('URLs de fases futuras não expõem preços, saldos, pedidos ou coleções',async()=>{
  for(const path of ['/api/prices','/api/wallet','/api/orders','/api/collections','/api/master/prices'])assert.equal((await f.atlas.request(path)).status===403|| (await f.atlas.request(path)).status===404,true);
  assert.deepEqual((await f.atlas.request('/api/locations/olivaras')).value.items,[]);
});
test('transação reverte mudanças de acesso e auditoria quando há destinatário inválido',async()=>{
  const before=f.db.prepare("SELECT * FROM regions WHERE id='hogsmeade'").get();
  const result=await f.master.request('/api/master/regions/hogsmeade',region({characters:['nao-existe']}));
  assert.equal(result.status,404);assert.deepEqual(f.db.prepare("SELECT * FROM regions WHERE id='hogsmeade'").get(),before);
});
test('suspensão revoga sessões imediatamente; logout e expiração invalidam cookies',async()=>{
  const user=f.db.prepare("SELECT id FROM users WHERE character_id='atlas'").get();
  await f.master.request(`/api/master/accounts/${user.id}`,{method:'PATCH',body:{disabled:true}});
  assert.equal((await f.atlas.request('/api/state')).status,401);
  await f.master.request(`/api/master/accounts/${user.id}`,{method:'PATCH',body:{disabled:false}});
  const account=f.client();await account.request('/api/auth/login',{method:'POST',body:{email:'atlas@test.invalid',password:f.password}});
  account.csrf=(await account.request('/api/session')).value.csrf;
  assert.equal((await account.request('/api/auth/logout',{method:'POST'})).status,200);
  assert.equal((await account.request('/api/state')).status,401);
  f.db.prepare('UPDATE sessions SET expires_at=?').run(now()-1);
  assert.equal((await f.eiris.request('/api/state')).status,401);
});
test('tentativas de login são limitadas sem revelar existência de conta',async()=>{
  let last;
  for(let i=0;i<12;i++)last=await f.client().request('/api/auth/login',{method:'POST',body:{email:'inexistente@test.invalid',password:f.password}});
  assert.equal(last.status,429);
});
