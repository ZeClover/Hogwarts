import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {contentDraftDefaults} from '../public/quick-create.js';
const policy={audience:'ALL',characters:[],groups:[],houses:[],schoolYears:[],cohorts:[],excludedCharacters:[],regionId:null,locationId:null};
const root=k=>'/api/master/content/'+k;
async function create(f,k,title,extra={}){const ctx=(await f.master.request('/api/master/content/context')).value,r=await f.master.request(root(k),{method:'POST',body:{payload:{...contentDraftDefaults(k,ctx.schemas[k].fields,'1890–1891'),title,...extra},policy,privateNotes:''}});assert.equal(r.status,201,JSON.stringify(r.value));return r.value;}
async function publish(f,k,r){return f.master.request(root(k)+'/'+r.id+'/publish',{method:'POST',body:{version:r.version}});}

test('cinco acervos e pool nascem mínimos, privados e sem descoberta, cópia, pacote ou recompensa',async()=>{
 const f=await fixture();try{
  for(const k of ['chocolatecards','bestiary','rarities','memories','curiosities','chocolatepools']){
   const r=await create(f,k,'REGISTRO SECRETO '+k);assert.equal(r.status,'DRAFT');assert.equal((await f.atlas.request('/api/content/'+k+'/'+r.id)).status,404);
   assert.equal((await f.atlas.request('/api/content/'+k+'?q=SECRETO')).value.total,0);
   if(k==='chocolatepools')assert.equal((await publish(f,k,r)).status,422);
   else {assert.equal((await publish(f,k,r)).status,200);assert.equal((await f.atlas.request('/api/content/'+k+'/'+r.id)).status,404);}
  }
  for(const table of ['collection_discoveries','chocolate_copies','chocolate_packets','delivery_events'])assert.equal(f.db.prepare('SELECT count(*) n FROM '+table).get().n,0);
 }finally{await f.close();}
});

test('pool sem configuração não inventa pesos ou chances e não concede pacotes',async()=>{
 const f=await fixture();try{
  const pool=await create(f,'chocolatepools','POOL VAZIO');for(const r of pool.extra.probabilities){assert.equal(r.weight,null);assert.equal(r.chance,null);}
  const grant=await f.master.request('/api/master/chocolate/grant',{method:'POST',body:{poolId:pool.id,poolVersion:pool.version,characters:['atlas'],quantity:1,origin:'Sessão',commandKey:'pool-rascunho-v5-001',confirm:true}});assert.equal(grant.status,422);
  const body={version:pool.version,payload:{...pool.payload,season:'Temporada escrita',commonWeight:1,uncommonWeight:0,rareWeight:0,legendaryWeight:0},policy,privateNotes:''};const next=(await f.master.request(root('chocolatepools')+'/'+pool.id,{method:'PATCH',body})).value;
  // Existing eligibility rules still reject a configured pool with no cards.
  assert.equal((await publish(f,'chocolatepools',next)).status,422);assert.equal((await f.master.request(root('chocolatepools')+'/'+pool.id)).value.status,'DRAFT');
  assert.equal(f.db.prepare('SELECT count(*) n FROM chocolate_packets').get().n,0);
 }finally{await f.close();}
});

test('rascunho de raridade não reclassifica obra escolar nem concede posse ou páginas',async()=>{
 const f=await fixture();try{
  const book=await create(f,'books','OBRA ESCOLAR');assert.equal((await publish(f,'books',book)).status,200);
  const rarity=await create(f,'rarities','REGISTRO EM PREPARAÇÃO',{bookId:book.id});assert.equal((await publish(f,'rarities',rarity)).status,422);
  assert.equal((await f.master.request(root('books')+'/'+book.id)).value.payload.category,'NORMAL');
  assert.equal(f.db.prepare('SELECT count(*) n FROM collection_discoveries').get().n,0);assert.equal((await f.atlas.request('/api/content/rarities')).value.total,0);
 }finally{await f.close();}
});
