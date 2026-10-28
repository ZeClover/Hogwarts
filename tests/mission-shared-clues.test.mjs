import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {questDiscovery,questCommand,discoveryPolicy} from './visual-discoveries-fixtures.mjs';

async function shared(f,q){const r=await f.master.request('/api/master/campaign/quests/'+q.id,{method:'PATCH',body:{version:q.version,payload:{...q.payload,cluesFollowMission:true},policy:q.policy,private:q.private}});assert.equal(r.status,200,JSON.stringify(r.value));return r.value;}
async function clue(f,q,title='A inscrição'){const r=await f.master.request('/api/master/campaign/quests/'+q.id+'/clues',{method:'POST',body:{version:q.version,definitionId:null,payload:{title,text:'Texto conhecido pelo grupo.',fileId:null,alt:'',npcId:null,locationId:null,collectionId:null,policy:discoveryPolicy(['atlas'])},privateNotes:'SEGREDO DA PISTA'}});assert.equal(r.status,200,JSON.stringify(r.value));return r.value;}

test('pistas publicadas seguem a missão para participantes atuais e futuros, sem escolha de destinatários',async()=>{
 const f=await fixture();try{
  let q=await questDiscovery(f,{characters:['atlas','eiris']});q=await shared(f,q);q=await clue(f,q);assert.equal((await f.atlas.request('/api/campaign/quests/'+q.id)).value.clues.length,0);q=await questCommand(f,q,'publish');
  for(const client of [f.atlas,f.eiris]){const r=await client.request('/api/campaign/quests/'+q.id);assert.equal(r.status,200);assert.equal(r.value.clues.length,1);assert.equal(r.value.clues[0].title,'A inscrição');assert.ok(!JSON.stringify(r.value).includes('SEGREDO DA PISTA'));}
  q=await questCommand(f,q,'revoke',{characters:['eiris']});assert.equal((await f.eiris.request('/api/campaign/quests/'+q.id)).status,404);
  q=await clue(f,q,'A segunda inscrição');q=await questCommand(f,q,'publish');assert.equal((await f.atlas.request('/api/campaign/quests/'+q.id)).value.clues.length,2);assert.equal((await f.eiris.request('/api/campaign/quests/'+q.id)).status,404);
  q=await questCommand(f,q,'release',{characters:['eiris']});assert.equal((await f.eiris.request('/api/campaign/quests/'+q.id)).value.clues.length,2);
  const count=f.db.prepare("SELECT count(*) n FROM delivery_events WHERE type='QUEST_CLUE' AND resource_id=?").get(q.id).n;assert.equal(count,4);q=await questCommand(f,q,'publish');q=await questCommand(f,q,'release',{characters:['atlas','eiris']});assert.equal(f.db.prepare("SELECT count(*) n FROM delivery_events WHERE type='QUEST_CLUE' AND resource_id=?").get(q.id).n,count);
  assert.equal((await f.atlas.request('/api/events')).value.items.filter(e=>e.kind==='NOVA PISTA').length,2);
 }finally{await f.close();}
});

test('publicação do novo editor ativa acesso herdado; usuário sem missão não recebe pista nem evento',async()=>{
 const f=await fixture();try{
  let q=await questDiscovery(f);q=await clue(f,q);const published=await f.master.request('/api/master/campaign/quests/'+q.id+'/publish',{method:'POST',body:{version:q.version,cluesFollowMission:true}});assert.equal(published.status,200);q=published.value;assert.equal(q.payload.cluesFollowMission,true);assert.equal(q.hasUnpublishedChanges,false);assert.equal((await f.atlas.request('/api/campaign/quests/'+q.id)).value.clues.length,1);assert.equal((await f.eiris.request('/api/campaign/quests/'+q.id)).status,404);assert.equal(f.db.prepare("SELECT count(*) n FROM delivery_events WHERE type='QUEST_CLUE' AND character_id='eiris'").get().n,0);
  const legacyPayload={...q.payload};delete legacyPayload.cluesFollowMission;const edited=await f.master.request('/api/master/campaign/quests/'+q.id,{method:'PATCH',body:{version:q.version,payload:legacyPayload,policy:{...q.policy,characters:['atlas','eiris']},private:q.private}});assert.equal(edited.status,200);assert.equal(edited.value.payload.cluesFollowMission,true);q=await questCommand(f,edited.value,'publish');assert.equal((await f.eiris.request('/api/campaign/quests/'+q.id)).status,404);q=await questCommand(f,q,'release',{characters:['eiris']});assert.equal((await f.eiris.request('/api/campaign/quests/'+q.id)).value.clues.length,1);
  const wrong=await f.eiris.request('/api/master/campaign/quests/'+q.id+'/publish',{method:'POST',body:{version:q.version,cluesFollowMission:true}});assert.equal(wrong.status,403);
 }finally{await f.close();}
});
