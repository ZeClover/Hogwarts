import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {contentDraftDefaults} from '../public/quick-create.js';
const policy={audience:'ALL',characters:[],groups:[],houses:[],schoolYears:[],cohorts:[],excludedCharacters:[],regionId:null,locationId:null};

test('carta com uma frase e sem destinatários salva só para o autor; prévia recusa criação sem efeitos',async()=>{
 const f=await fixture();try{
  const payload={subject:'',body:'Uma frase privada.',signature:'',senderNpcId:null,characters:[],npcs:[],academicYear:'1890–1891',style:'PARCHMENT',templateId:null};
  const count=()=>f.db.prepare('SELECT count(*) n FROM letters').get().n;
  assert.equal((await f.master.request('/api/mail?view_as=atlas',{method:'POST',body:{payload}})).status,403);assert.equal(count(),0);
  let r=await f.atlas.request('/api/mail',{method:'POST',body:{payload}});assert.equal(r.status,201,JSON.stringify(r.value));r=r.value;
  for(const c of [f.master,f.eiris])assert.equal((await c.request('/api/mail/'+r.id)).status,404);
  assert.equal((await f.atlas.request('/api/mail/'+r.id+'/send',{method:'POST',body:{version:r.version,confirm:true}})).status,422);
  assert.equal((await f.master.request('/api/master/mail')).value.items.length,0);assert.equal(f.db.prepare('SELECT count(*) n FROM delivery_events').get().n,0);
  r=(await f.atlas.request('/api/mail/'+r.id,{method:'PATCH',body:{version:r.version,payload:{...payload,characters:['eiris']}}})).value;
  r=(await f.atlas.request('/api/mail/'+r.id+'/send',{method:'POST',body:{version:r.version,confirm:true}})).value;assert.equal(r.status,'SUBMITTED');assert.equal((await f.master.request('/api/mail/'+r.id)).status,200);assert.equal((await f.eiris.request('/api/mail/'+r.id)).status,404);
 }finally{await f.close();}
});

test('pontos sem motivo exigem confirmação manual e idempotência; jogador só recebe os totais',async()=>{
 const f=await fixture();try{
  const start=await f.master.request('/api/master/cup/start',{method:'POST',body:{academicYear:'1890–1891',confirm:true}});assert.equal(start.status,200);
  const body={academicYear:'1890–1891',version:start.value.version,houseId:'gryffindor',amount:7,characterId:null,eventId:null,commandKey:'pontos-sem-motivo-v5-001',confirm:true};
  assert.equal((await f.master.request('/api/master/cup/points',{method:'POST',body:{...body,confirm:false}})).status,422);assert.equal(f.db.prepare('SELECT count(*) n FROM house_point_entries').get().n,0);
  for(let i=0;i<2;i++)assert.equal((await f.master.request('/api/master/cup/points',{method:'POST',body})).status,200);
  const entries=f.db.prepare('SELECT * FROM house_point_entries').all();assert.equal(entries.length,1);assert.equal(entries[0].reason,'');
  const publicCup=(await f.atlas.request('/api/cup')).value;assert.equal(publicCup.competition.houses.find(h=>h.id==='gryffindor').points,7);assert.ok(!('entries' in publicCup));assert.ok(!JSON.stringify(publicCup).includes('reason'));
  assert.equal(f.db.prepare("SELECT count(*) n FROM audit_log WHERE action='HOUSE_POINTS_POSTED'").get().n,1);
 }finally{await f.close();}
});

test('modelo mínimo persiste privado e continua editável sem publicar ou alterar registros antigos',async()=>{
 const f=await fixture();try{
  const ctx=(await f.master.request('/api/master/content/context')).value,payload={...contentDraftDefaults('templates',ctx.schemas.templates.fields,'1890–1891'),title:'MODELO MÍNIMO'};
  const r=await f.master.request('/api/master/content/templates',{method:'POST',body:{payload,policy,privateNotes:''}});assert.equal(r.status,201);assert.equal(r.value.status,'DRAFT');assert.equal((await f.atlas.request('/api/content/templates/'+r.value.id)).status,404);
  const p=await f.master.request('/api/master/content/templates/'+r.value.id,{method:'PATCH',body:{version:r.value.version,payload:{...r.value.payload,heading:'Cabeçalho escrito',family:'LETTER',variant:'FORMAL'},policy,privateNotes:''}});assert.equal(p.status,200);assert.equal(p.value.payload.family,'LETTER');assert.equal(p.value.publishedRevision,null);
 }finally{await f.close();}
});
