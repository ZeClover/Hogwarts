import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {quickCreateRequest} from '../public/quick-create.js';

const data=values=>new Map(Object.entries(values));
test('criação mínima persiste rascunhos privados sem arquivos, preços, ofertas ou recompensas',async()=>{
 const f=await fixture();
 try{
  const context={currentAcademicYear:(await f.master.request('/api/state')).value.calendar.academicYear};
  for(const kind of ['quests','stories','items','npcs']){
   const request=quickCreateRequest(kind,data({name:'RASCUNHO MÍNIMO '+kind,protagonistId:'atlas'}),context);
   const result=await f.master.request(request.api,{method:'POST',body:request.body});
   assert.equal(result.status,201,JSON.stringify(result.value));assert.equal(result.value.status,'DRAFT');
   const reloaded=await f.master.request(request.api+'/'+result.value.id);assert.equal(reloaded.status,200);
   assert.deepEqual(reloaded.value.payload,result.value.payload);
   assert.equal((await f.atlas.request(request.api.replace('/master','')+'/'+result.value.id)).status,404);
   assert.equal((await f.eiris.request(request.api.replace('/master','')+'/'+result.value.id)).status,404);
   if(kind==='quests'||kind==='stories')assert.equal(result.value.payload.academicYear,context.currentAcademicYear);
   if(kind==='items'){assert.equal(result.value.private.referenceValueNuques,null);assert.equal(result.value.private.chosenPriceNuques,null);assert.deepEqual(result.value.private.effects,[]);assert.equal(result.value.payload.fileId,null);}
   if(kind==='npcs')assert.equal(result.value.payload.portraitFileId,null);
  }
  for(const table of ['reward_grants','certificate_issues','offer_stock','workshop_files'])assert.equal(f.db.prepare('SELECT count(*) n FROM '+table).get().n,0);
  assert.equal(f.db.prepare("SELECT count(*) n FROM content_records WHERE kind IN ('shops','offers')").get().n,0);
 }finally{await f.close();}
});

test('defaults usam ano recebido e novos objetos não compartilham políticas ou efeitos',()=>{
 const a=quickCreateRequest('quests',data({name:'Uma missão'}),{currentAcademicYear:'1891–1892'});
 assert.equal(a.body.payload.academicYear,'1891–1892');assert.equal(a.body.payload.kind,'Side-Quest');
 const i=quickCreateRequest('items',data({name:'Um objeto'}),{}),j=quickCreateRequest('items',data({name:'Outro objeto'}),{});
 i.body.policy.characters.push('atlas');i.body.private.effects.push({name:'Só na fixture'});
 assert.deepEqual(j.body.policy.characters,[]);assert.deepEqual(j.body.private.effects,[]);
});

test('mesmo corpo mínimo exige Mestre e recusa prévia, título vazio e protagonista ausente',async()=>{
 const f=await fixture();
 try{
  const context={currentAcademicYear:(await f.master.request('/api/state')).value.calendar.academicYear};
  for(const kind of ['quests','items','npcs']){
   const request=quickCreateRequest(kind,data({name:'Recusado'}),context);
   assert.equal((await f.atlas.request(request.api,{method:'POST',body:request.body})).status,403);
   assert.equal((await f.master.request(request.api+'?view_as=atlas',{method:'POST',body:request.body})).status,403);
   const blank=quickCreateRequest(kind,data({name:''}),context);
   assert.equal((await f.master.request(blank.api,{method:'POST',body:blank.body})).status,400);
  }
  const story=quickCreateRequest('stories',data({name:'Sem titular'}),context);
  assert.equal((await f.master.request(story.api,{method:'POST',body:story.body})).status,400);
 }finally{await f.close();}
});
