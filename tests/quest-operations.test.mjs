import { TextDecoder } from "node:util";
import { before,after,test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.mjs';
let f;
const base='/api/master/campaign/quests';
const policy=(extra={})=>({audience:'ALL',characters:[],groups:[],houses:[],schoolYears:[],cohorts:[],excludedCharacters:[],regionId:null,locationId:null,...extra});
async function cmd(q,action,body={}){const r=await f.master.request(`${base}/${q.id}/${action}`,{method:'POST',body:{version:q.version,...body}});assert.equal(r.status,200,JSON.stringify(r.value));return r.value;}
async function make(){const r=await f.master.request(base,{method:'POST',body:{payload:{title:'OPERAÇÃO TESTE',summary:'Resumo',kind:'Side-quest',academicYear:'1890–1891',fileId:null,alt:'',npcId:null,locationId:null,hook:''},policy:policy(),private:{synopsis:'SECRETO',importance:'',releaseConditions:'',notes:''}}});assert.equal(r.status,201);return r.value;}
async function stage(q,kind,title,extra={}){return cmd(q,kind,{definitionId:null,payload:kind==='objectives'?{title,description:'Público',optional:false,internalOnly:false,policy:policy(),...extra}:{title,text:'PISTA REVELADA',fileId:null,alt:'',npcId:null,locationId:null,policy:policy(),...extra},privateNotes:'SEGREDO DA ETAPA'});}
async function started(q){q=await cmd(q,'publish');q=await cmd(q,'release',{characters:['atlas','eiris']});return cmd(q,'start',{characters:['atlas','eiris']});}
const read=q=>f.atlas.request('/api/campaign/quests/'+q.id);
before(async()=>{f=await fixture();});after(async()=>{await f?.close();});
test('três objetivos persistem/reordenam e estados são exclusivos do Mestre e destinatário',async()=>{
 let q=await make();for(const title of ['UM','DOIS','TRES'])q=await stage(q,'objectives',title);const ids=q.objectives.map(r=>r.id).toReversed();q=await cmd(q,'reorder-objectives',{ids});q=await started(q);assert.deepEqual((await read(q)).value.objectives,[]);
 for(const objectiveId of ids)q=await cmd(q,'objective-state',{objectiveId,characters:['atlas'],state:'COMPLETED'});assert.deepEqual((await read(q)).value.objectives.map(o=>o.title),['TRES','DOIS','UM']);assert.deepEqual((await f.eiris.request('/api/campaign/quests/'+q.id)).value.objectives,[]);
 assert.equal((await f.atlas.request(`${base}/${q.id}/objective-state`,{method:'POST',body:{version:q.version,objectiveId:ids[0],characters:['atlas'],state:'FAILED'}})).status,403);
 q=await cmd(q,'objective-state',{objectiveId:ids[0],characters:['atlas'],state:'HIDDEN'});assert.equal((await read(q)).value.objectives.length,2);assert.ok(!JSON.stringify((await read(q)).value).includes('SEGREDO DA ETAPA'));
});
test('objetivo interno e política por campo nunca vazam título ou contagem',async()=>{
 let q=await stage(await make(),'objectives','INTERNO',{internalOnly:true});q=await stage(q,'objectives','SO EIRIS',{policy:policy({excludedCharacters:['atlas']})});q=await started(q);
 q=await cmd(q,'objective-state',{objectiveId:q.objectives[0].id,characters:['atlas'],state:'IN_PROGRESS'});assert.deepEqual((await read(q)).value.objectives,[]);
 assert.equal((await f.master.request(`${base}/${q.id}/objective-state`,{method:'POST',body:{version:q.version,objectiveId:q.objectives[1].id,characters:['atlas','eiris'],state:'REVEALED'}})).status,422);assert.deepEqual((await read(q)).value.objectives,[]);
});
test('pistas têm outbox individual persistente, reconhecimento/replay sem concessão e revogação imediata',async()=>{
 let q=await stage(await make(),'clues','PISTA A');q=await started(q);const id=q.clues[0].id;q=await cmd(q,'reveal-clue',{clueId:id,characters:['atlas'],presentation:'ANIMATED'});
 const events=(await f.atlas.request('/api/events')).value.items;assert.equal(events.length,1);assert.equal(events[0].title,'PISTA A');assert.deepEqual((await f.eiris.request('/api/events')).value.items,[]);
 const before=f.db.prepare('SELECT count(*) n FROM quest_clue_reveals').get().n;for(let i=0;i<2;i++)assert.equal((await f.atlas.request('/api/events/'+events[0].id+'/ack',{method:'POST'})).status,200);assert.deepEqual((await f.atlas.request('/api/events')).value.items,[]);assert.equal((await f.atlas.request('/api/events/'+events[0].id)).status,200);assert.equal(f.db.prepare('SELECT count(*) n FROM quest_clue_reveals').get().n,before);
 assert.equal((await f.eiris.request('/api/events/'+events[0].id)).status,404);assert.equal((await f.master.request('/api/events/'+events[0].id+'/ack?view_as=atlas',{method:'POST'})).status,403);
 q=await cmd(q,'revoke-clue',{clueId:id,characters:['atlas']});assert.equal((await f.atlas.request('/api/events/'+events[0].id)).status,404);assert.deepEqual((await read(q)).value.clues,[]);
});
test('SSE autenticado só sinaliza IDs autorizados e prévia não consome fila',async()=>{
 let q=await stage(await make(),'clues','PISTA SSE');q=await started(q);q=await cmd(q,'reveal-clue',{clueId:q.clues[0].id,characters:['atlas'],presentation:'SILENT'});
 const before=JSON.stringify(f.db.prepare('SELECT * FROM delivery_events').all());const r=await fetch(f.config.origin+'/api/events/stream',{headers:{Cookie:f.atlas.cookie}});assert.equal(r.status,200);const reader=r.body.getReader();const data=new TextDecoder().decode((await reader.read()).value);assert.ok(data.includes('data:'));assert.ok(!data.includes('PISTA SSE'));await reader.cancel();
 assert.equal((await f.master.request('/api/events/stream?view_as=atlas')).status,403);await f.master.request(`/api/master/campaign/quests/${q.id}/preview?character=atlas&source=published`);await f.master.request('/api/events?view_as=atlas');assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM delivery_events').all()),before);
});
test('todos os desfechos são manuais; reabrir preserva história e não credita recompensa',async()=>{
 let q=await started(await make());const itemsBefore=f.db.prepare('SELECT count(*) n FROM catalog_items').get().n;
 for(const result of ['SUCCESS','PARTIAL_SUCCESS','FAILURE']){q=await cmd(q,'close',{result,epilogue:'EPILOGO '+result,date:'Noite de outono',privateNotes:'MOTIVO SECRETO'});assert.equal((await read(q)).value.state,'CLOSED');assert.equal((await f.atlas.request('/api/campaign/announcements/'+q.id)).status,404);assert.equal((await read(q)).value.outcomes.at(-1).result,result);assert.ok(!JSON.stringify((await read(q)).value).includes('MOTIVO SECRETO'));q=await cmd(q,'reopen',{reason:'Correção narrativa'});}
 assert.equal((await read(q)).value.outcomes.length,3);assert.equal(f.db.prepare('SELECT count(*) n FROM catalog_items').get().n,itemsBefore);assert.equal(q.operationState,'OPEN');
});
test('editar/republicar pistas e objetivos preserva snapshots até confirmação e concorrência retorna 409',async()=>{
 let q=await stage(await make(),'clues','VERSAO ANTIGA');q=await started(q);const id=q.clues[0].id;q=await cmd(q,'reveal-clue',{clueId:id,characters:['atlas'],presentation:'SILENT'});
 const payload={...JSON.parse(q.clues[0].draft_json),title:'NOVA VERSAO'};delete payload.kind;
 q=await cmd(q,'clues',{definitionId:id,payload,privateNotes:''});q=await cmd(q,'publish');assert.equal((await read(q)).value.clues[0].title,'VERSAO ANTIGA');
 const responses=await Promise.all([1,2].map(()=>f.master.request(`${base}/${q.id}/reveal-clue`,{method:'POST',body:{version:q.version,clueId:id,characters:['atlas'],presentation:'ANIMATED'}})));assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal((await read(q)).value.clues[0].title,'NOVA VERSAO');assert.equal(f.db.prepare('SELECT count(*) n FROM quest_clue_reveals WHERE quest_id=?').get(q.id).n,1);
});
