import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture,commercialFixture} from './helpers.mjs';
import {validPassword,verifyPassword} from '../dist/auth.js';
import {questDiscovery,questCommand,contentDiscovery,contentCommand,bookPayload,discoveryPolicy} from './visual-discoveries-fixtures.mjs';

test('senha aceita oito caracteres livres, recusa sete e preserva hashes e contas anteriores',async()=>{
 const f=await fixture();try{
  for(const value of ['abcdefgh','a'.repeat(128),'12345678'])assert.equal(validPassword(value),value);
  for(const value of ['abcdefg','a'.repeat(129),null])assert.throws(()=>validPassword(value),/8 e 128/);
  const raw=await f.invite('darius','novo@test.invalid'),client=f.client();
  const activate=password=>client.request('/api/auth/activate',{method:'POST',body:{token:raw,email:'novo@test.invalid',password}});
  assert.equal((await activate('abcdefg')).status,400);assert.equal((await activate('abcdefgh')).status,200);
  const hash=f.db.prepare('SELECT password_hash FROM users WHERE email=?').get('novo@test.invalid').password_hash;assert.ok(await verifyPassword('abcdefgh',hash));assert.ok(!hash.includes('abcdefgh'));
  const old=f.db.prepare('SELECT password_hash FROM users WHERE character_id=?').get('atlas').password_hash;
  assert.equal((await f.client().request('/api/auth/login',{method:'POST',body:{email:'atlas@test.invalid',password:f.password}})).status,200);
  assert.equal(f.db.prepare('SELECT password_hash FROM users WHERE character_id=?').get('atlas').password_hash,old);
  assert.equal((await f.client().request('/api/auth/login',{method:'POST',body:{email:'novo@test.invalid',password:'abcdefgh'}})).status,200);
 }finally{await f.close();}
});
test('galeria reutiliza biblioteca privada, nomes enviados e imagens aprovadas sem expor arquivos ao jogador',async()=>{
 const f=await fixture();try{
  const bytes=await readFile('public/assets/hogwarts_corredor_velas.webp');const uploaded=await f.master.request('/api/master/workshop/files',{method:'POST',raw:true,body:bytes,headers:{'Content-Type':'image/webp','X-Upload-Name':encodeURIComponent('Corredor das Velas.webp')}});assert.equal(uploaded.status,201);assert.equal(uploaded.value.name,'Corredor das Velas.webp');
  const gallery=await f.master.request('/api/master/workshop/gallery');assert.equal(gallery.status,200);assert.ok(gallery.value.items.some(i=>i.asset==='hogwarts_corredor_velas.webp'));assert.ok(gallery.value.items.some(i=>i.id===uploaded.value.id&&i.name==='Corredor das Velas.webp'));
  for(const client of [f.client(),f.atlas,f.eiris])assert.ok([401,403].includes((await client.request('/api/master/workshop/gallery')).status));
  const q=await questDiscovery(f,{fileId:uploaded.value.id});const b=await contentDiscovery(f,'books',bookPayload(uploaded.value.id));assert.equal(f.db.prepare('SELECT count(*) n FROM workshop_files').get().n,1);
  for(const record of [(await f.atlas.request('/api/campaign/quests/'+q.id)).value,(await f.atlas.request('/api/content/books/'+b.id)).value]){assert.equal((await f.atlas.request(record.image)).status,200);assert.equal((await f.eiris.request(record.image)).status,404);}
  assert.equal((await f.atlas.request(uploaded.value.image)).status,403);
 }finally{await f.close();}
});
test('missão tem descoberta individual persistente; dispensar, republicar e ler não duplicam nem concedem recompensas',async()=>{
 const f=await fixture();try{
  let q=await questDiscovery(f);const events=(await f.atlas.request('/api/events')).value.items;assert.equal(events.length,1);const e=events[0];assert.match(e.kind,/SIDE-QUEST/);assert.equal(e.href,'/portal/missoes/grupo/'+q.id);assert.ok(!JSON.stringify(e).includes('SEGREDO'));
  assert.deepEqual((await f.eiris.request('/api/events')).value.items,[]);assert.equal((await f.eiris.request('/api/events/'+e.id)).status,404);assert.equal((await f.eiris.request('/api/events/'+e.id+'/ack',{method:'POST'})).status,404);
  const before=f.db.prepare('SELECT * FROM quest_participants WHERE quest_id=?').all(q.id);for(let i=0;i<2;i++)assert.equal((await f.atlas.request('/api/events/'+e.id+'/ack',{method:'POST'})).status,200);
  assert.deepEqual((await f.atlas.request('/api/events')).value.items,[]);assert.equal((await f.atlas.request('/api/events/history')).value.items[0].id,e.id);assert.deepEqual(f.db.prepare('SELECT * FROM quest_participants WHERE quest_id=?').all(q.id),before);
  q=await questCommand(f,q,'publish');q=await questCommand(f,q,'release',{characters:['atlas']});assert.deepEqual((await f.atlas.request('/api/events')).value.items,[]);assert.equal(f.db.prepare('SELECT count(*) n FROM reward_grants').get().n,0);
  q=await questCommand(f,q,'revoke',{characters:['atlas']});assert.equal((await f.atlas.request('/api/events/'+e.id)).status,404);assert.deepEqual((await f.atlas.request('/api/events/history')).value.items,[]);
 }finally{await f.close();}
});
test('livro, aula e página ilustrada seguem autorizações de conteúdo e camada, inclusive revogação',async()=>{
 const f=await fixture();try{
  const file=(await f.master.request('/api/master/workshop/files',{method:'POST',body:{asset:'biblioteca_hogwarts.webp'}})).value;
  let b=await contentDiscovery(f,'books',bookPayload(file.id));await contentDiscovery(f,'lessons',{...bookPayload(file.id),author:undefined,category:undefined,academicYear:'1890–1891',level:'Fundamentos',prerequisites:'',exercises:''});
  const first=(await f.atlas.request('/api/events')).value.items;assert.ok(first.some(e=>e.kind==='NOVO LIVRO'));assert.ok(first.some(e=>e.kind==='NOVA AULA'));assert.ok(!JSON.stringify(first).includes('Texto autorizado da página'));
  b=await contentCommand(f,b,'reveal-pages',{pageIds:['page-visual'],characters:['atlas'],presentation:'ANIMATED'});const event=(await f.atlas.request('/api/events')).value.items.find(e=>e.kind==='NOVA PÁGINA DESCOBERTA');assert.equal(event.title,'A primeira passagem');assert.equal((await f.atlas.request(event.image)).status,200);assert.equal((await f.eiris.request(event.image)).status,404);
  await contentCommand(f,b,'revoke-pages',{pageIds:['page-visual'],characters:['atlas']});assert.equal((await f.atlas.request('/api/events/'+event.id)).status,404);
 }finally{await f.close();}
});
test('criatura, recordação e carta de Sapo mantêm imagem, destinatário e ausência de posse automática',async()=>{
 const f=await fixture();try{
  const file=(await f.master.request('/api/master/workshop/files',{method:'POST',body:{asset:'floresta_proibida.webp'}})).value;
  for(const kind of ['bestiary','memories','chocolatecards']){let r=await contentDiscovery(f,kind,{title:'Registro '+kind,description:'Somente o conhecido.',fileId:file.id,alt:'Floresta mágica',pages:[],...(kind==='bestiary'?{classification:'',notableIndividuals:'SEGREDO'}:kind==='memories'?{narrativeDate:''}:{rarity:'COMMON',season:'',eligible:false})});r=await contentCommand(f,r,'discover',{characters:['atlas'],presentation:'ANIMATED',observed:true,encounter:'',personalText:''});const e=(await f.atlas.request('/api/events')).value.items.find(e=>e.title==='Registro '+kind);assert.ok(e.image);assert.equal((await f.atlas.request(e.image)).status,200);assert.equal((await f.eiris.request('/api/events/'+e.id)).status,404);assert.ok(!JSON.stringify(e).includes('SEGREDO'));}
  assert.equal(f.db.prepare('SELECT count(*) n FROM item_possessions').get().n,0);
 }finally{await f.close();}
});
test('item, recompensa e selo geram uma apresentação por concessão, sem duplicação de coleção',async()=>{
 const f=await fixture();try{
  let q=await questDiscovery(f);q=await questCommand(f,q,'start',{characters:['atlas']});const c=await commercialFixture(f);
  for(const kind of ['ITEM','NARRATIVE']){let r=await f.master.request('/api/master/documents/quests/'+q.id+'/rewards',{method:'POST',body:{payload:{kind,referenceId:kind==='ITEM'?c.item.id:null,title:'Prêmio '+kind,text:'Parabéns.',nuques:0,characters:['atlas']}}});assert.equal(r.status,201);const grant=()=>f.master.request('/api/master/documents/quests/'+q.id+'/rewards/'+r.value.id+'/grant',{method:'POST',body:{version:r.value.version,confirm:true,characters:['atlas']}});assert.equal((await grant()).status,200);assert.equal((await grant()).status,200);}
  q=await questCommand(f,q,'close',{result:'SUCCESS',epilogue:'O corredor foi encontrado.',date:'',privateNotes:'SEGREDO'});const events=(await f.atlas.request('/api/events')).value.items;assert.equal(events.filter(e=>e.kind==='NOVO ITEM RECEBIDO').length,1);assert.equal(events.filter(e=>e.kind==='NOVA RECOMPENSA').length,1);assert.equal(events.filter(e=>e.kind==='NOVO SELO DE CONCLUSÃO').length,1);assert.ok(!(await f.eiris.request('/api/events')).value.items.some(e=>/RECOMPENSA|ITEM|SELO/.test(e.kind)));assert.equal(f.db.prepare('SELECT count(*) n FROM item_possessions').get().n,1);
 }finally{await f.close();}
});
test('liberação de local secreto e novo membro de grupo geram apenas descobertas recém-autorizadas',async()=>{
 const f=await fixture();try{
  const body={enabled:true,isSecret:true,audience:'SELECTED',characters:['atlas'],groups:[],x:null,y:null};assert.equal((await f.master.request('/api/master/locations/sala-precisa',{method:'PATCH',body})).status,404);
  const r=await f.master.request('/api/master/locations',{method:'POST',body:{title:'Sala de teste secreta',regionId:'hogwarts',image:'hogwarts_corredor_velas.webp'}});assert.equal(r.status,201);const id=r.value.id;assert.equal((await f.master.request('/api/master/locations/'+id,{method:'PATCH',body})).status,200);
  const event=(await f.atlas.request('/api/events')).value.items.find(e=>e.title==='Sala de teste secreta');assert.ok(event);assert.equal((await f.eiris.request('/api/events/'+event.id)).status,404);assert.equal((await f.master.request('/api/master/locations/'+id,{method:'PATCH',body})).status,200);assert.equal((await f.atlas.request('/api/events')).value.items.filter(e=>e.title==='Sala de teste secreta').length,1);
  const group=(await f.master.request('/api/master/groups',{method:'POST',body:{name:'Pesquisadores',members:[]}})).value;const b=await contentDiscovery(f,'books',bookPayload(),[]);let save=await f.master.request('/api/master/content/books/'+b.id,{method:'PATCH',body:{version:b.version,payload:b.payload,policy:{...discoveryPolicy([]),groups:[group.id]},privateNotes:''}});assert.equal(save.status,200);await contentCommand(f,save.value,'publish');assert.equal((await f.eiris.request('/api/events')).value.items.length,0);assert.equal((await f.master.request('/api/master/groups/'+group.id,{method:'PATCH',body:{name:'Pesquisadores',members:['eiris']}})).status,200);assert.ok((await f.eiris.request('/api/events')).value.items.some(e=>e.title===b.payload.title));
 }finally{await f.close();}
});

test('Profeta, anuário e retrospectiva possuem revelação com capa, sem duplicar ao atualizar',async()=>{
 const f=await fixture();try{
  const file=(await f.master.request('/api/master/workshop/files',{method:'POST',body:{asset:'correio_pergaminhos.webp'}})).value;
  const base={title:'Edição ilustrada',academicYear:'1890–1891',description:'Apresentação autorizada.',fileId:file.id,alt:'Pergaminhos de Hogwarts',articles:[]};
  for(const [kind,payload]of [['newspapers',{...base,number:'',narrativeDate:'',headline:'Notícia de Hogwarts',subtitle:'',authors:'',notes:''}],['yearbooks',{...base,resultId:null}],['retrospectives',{...base,title:'Recordações particulares de Atlas',characterId:'atlas'}]]){
   let row=await contentDiscovery(f,kind,payload);const mine=(await f.atlas.request('/api/events')).value.items.filter(e=>e.href.endsWith('/'+row.id));assert.equal(mine.length,1);assert.equal(mine[0].presentation,'ANIMATED');assert.equal((await f.atlas.request(mine[0].image)).status,200);row=await contentCommand(f,row,'publish');assert.equal((await f.atlas.request('/api/events')).value.items.filter(e=>e.href.endsWith('/'+row.id)).length,1);
   if(kind==='retrospectives'){assert.equal((await f.eiris.request('/api/events/'+mine[0].id)).status,404);assert.equal((await f.eiris.request(mine[0].image)).status,404);}
  }
 }finally{await f.close();}
});
test('informação progressiva de NPC usa o snapshot autorizado e desaparece após revogar',async()=>{
 const f=await fixture();try{
  const base='/api/master/workshop/npcs';let r=await f.master.request(base,{method:'POST',body:{payload:{name:'Guardiã dos arquivos',description:'Bibliotecária.',role:'OTHER',houseId:null,locationId:null,relatedLocations:[],portraitFileId:null,portraitAlt:''},policy:discoveryPolicy(),privateNotes:'SEGREDO'}});assert.equal(r.status,201);let n=r.value;
  const cmd=async(action,extra={})=>{const r=await f.master.request(base+'/'+n.id+'/'+action,{method:'POST',body:{version:n.version,...extra}});assert.equal(r.status,200,JSON.stringify(r.value));n=r.value;};
  await cmd('fragments',{fragmentId:null,title:'Uma chave esquecida',text:'Informação conhecida.',policy:discoveryPolicy()});await cmd('publish');const fragmentId=n.payload.fragments[0].id;await cmd('reveal',{fragmentId,characters:['atlas']});const events=(await f.atlas.request('/api/events')).value.items;assert.equal(events.length,1);assert.equal(events[0].title,'Uma chave esquecida');assert.ok(!JSON.stringify(events).includes('SEGREDO'));assert.equal((await f.eiris.request('/api/events/'+events[0].id)).status,404);await cmd('reveal',{fragmentId,characters:['atlas']});assert.equal((await f.atlas.request('/api/events')).value.items.length,1);await cmd('revoke',{fragmentId,characters:['atlas']});assert.equal((await f.atlas.request('/api/events/'+events[0].id)).status,404);
 }finally{await f.close();}
});
