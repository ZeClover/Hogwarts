import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,commercialFixture} from './helpers.mjs';

const policy={audience:'ALL',characters:[],groups:[],houses:[],schoolYears:[],cohorts:[],excludedCharacters:[],regionId:null,locationId:null};
const base='/api/master/campaign/quests';
const body=(sheet={},title='FICHA DE TESTE')=>({payload:{title,kind:'Principal',summary:'Resumo público',academicYear:'1890–1891',fileId:null,alt:'',npcId:null,locationId:null,hook:'',cluesFollowMission:true},private:{synopsis:'Legado preservado',importance:'',releaseConditions:'',notes:'',sheet},policy});

test('ficha longa, código exclusivo, filtros e compatibilidade não publicam planejamento',async()=>{
 const f=await fixture();try{
  const text='Desenvolvimento privado\n'.repeat(4500).trim(),r=await f.master.request(base,{method:'POST',body:body({description:'DESCRIÇÃO PRIVADA',development:text,planningStatus:'Aprovada',schoolYear:'4',mainLocation:'Uma torre ainda não cadastrada',mainReward:'Uma sala particular em Hogwarts',worldConsequences:'SEGREDO DO MUNDO'})});assert.equal(r.status,201,JSON.stringify(r.value));let q=r.value;assert.equal(q.private.sheet.development,text);assert.match(q.private.sheet.code,/^MQ-\d+$/);assert.equal(f.db.prepare('SELECT count(*) n FROM reward_grants').get().n,0);
  const second=await f.master.request(base,{method:'POST',body:body({},'OUTRA FICHA')});assert.notEqual(second.value.private.sheet.code,q.private.sheet.code);
  for(const filter of ['q='+q.private.sheet.code,'schoolYear=4','planningStatus=Aprovada'])assert.deepEqual((await f.master.request(base+'?'+filter)).value.items.map(i=>i.id),[q.id]);
  const old={...body(),version:q.version};delete old.private.sheet;old.payload.title='Salvo por cliente antigo';q=(await f.master.request(base+'/'+q.id,{method:'PATCH',body:old})).value;assert.equal(q.private.sheet.development,text);assert.equal(q.private.synopsis,'Legado preservado');
  const copied=await f.master.request(base+'/'+q.id+'/duplicate',{method:'POST',body:{version:q.version}});assert.equal(copied.status,200);assert.notEqual(copied.value.private.sheet.code,q.private.sheet.code);assert.equal(copied.value.private.sheet.development,text);
  q=(await f.master.request(base+'/'+q.id+'/publish',{method:'POST',body:{version:q.version}})).value;await f.master.request(base+'/'+q.id+'/release',{method:'POST',body:{version:q.version,characters:['atlas']}});const publicRecord=await f.atlas.request('/api/campaign/quests/'+q.id);assert.equal(publicRecord.status,200);assert.doesNotMatch(JSON.stringify(publicRecord.value),/DESCRIÇÃO PRIVADA|SEGREDO DO MUNDO|Desenvolvimento privado/);assert.equal((await f.atlas.request(base+'/'+q.id)).status,403);
 }finally{await f.close();}
});

test('vínculos inválidos e anos fora da faixa não alteram a ficha; itens têm quantidade e concessão explícita',async()=>{
 const f=await fixture();try{
  const c=await commercialFixture(f);let q=(await f.master.request(base,{method:'POST',body:body({items:[{id:c.item.id,quantity:3}]})})).value;
  for(const sheet of [{schoolYear:'8'},{npcIds:['inexistente']},{items:[{id:c.item.id,quantity:0}]},{items:[{id:c.item.id,quantity:true}]}])assert.equal((await f.master.request(base+'/'+q.id,{method:'PATCH',body:{...body(sheet),version:q.version}})).status,400);
  assert.equal((await f.master.request(base+'/'+q.id)).value.private.sheet.items[0].quantity,3);
  q=(await f.master.request(base+'/'+q.id,{method:'PATCH',body:{...body({description:'Somente o texto mudou'}),version:q.version}})).value;assert.equal(q.private.sheet.items[0].quantity,3);
  q=(await f.master.request(base+'/'+q.id+'/publish',{method:'POST',body:{version:q.version}})).value;q=(await f.master.request(base+'/'+q.id+'/release',{method:'POST',body:{version:q.version,characters:['atlas','eiris']}})).value;
  const endpoint='/api/master/documents/quests/'+q.id+'/rewards';const item=(await f.master.request(endpoint,{method:'POST',body:{payload:{kind:'ITEM',referenceId:c.item.id,title:'Três itens',text:'',nuques:0,characters:['atlas'],quantity:3}}})).value;assert.equal(f.db.prepare('SELECT count(*) n FROM item_possessions').get().n,0);
  assert.equal((await f.master.request(endpoint+'/'+item.id+'/grant',{method:'POST',body:{version:item.version,characters:['atlas'],confirm:true}})).status,200);assert.equal(f.db.prepare('SELECT quantity FROM item_possessions WHERE item_id=?').get(c.item.id).quantity,3);
  const money=(await f.master.request(endpoint,{method:'POST',body:{payload:{kind:'MONEY',referenceId:null,title:'Total dividido',text:'',nuques:5,characters:['eiris','atlas'],moneyScope:'GROUP'}}})).value;assert.equal(f.db.prepare('SELECT count(*) n FROM wallet_entries').get().n,0);
  const grant=()=>f.master.request(endpoint+'/'+money.id+'/grant',{method:'POST',body:{version:money.version,characters:['atlas','eiris'],confirm:true}});assert.equal((await grant()).status,200);assert.equal((await grant()).status,200);assert.deepEqual(f.db.prepare('SELECT character_id,amount FROM wallet_entries ORDER BY character_id').all().map(r=>({...r})),[{character_id:'atlas',amount:3},{character_id:'eiris',amount:2}]);
 }finally{await f.close();}
});
