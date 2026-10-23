import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {contentDraftDefaults,quickCreateRequest} from '../public/quick-create.js';
const policy={audience:'SELECTED',characters:[],groups:[],houses:[],schoolYears:[],cohorts:[],excludedCharacters:[],regionId:null,locationId:null};
async function npc(f,name){const r=await f.master.request('/api/master/workshop/npcs',{method:'POST',body:{payload:{name,description:'Visível após confirmação',role:'OTHER',houseId:null,locationId:null,relatedLocations:[],portraitFileId:null,portraitAlt:''},policy,privateNotes:'SEGREDO QUE NÃO PERTENCE AO ÍNDICE'}});assert.equal(r.status,201);return r.value;}
test('índice MASTER pagina todas as origens; jogador e preview não recebem registros nem contagens',async()=>{
 const f=await fixture();try{
  for(let i=0;i<27;i++)await npc(f,'ÍNDICE '+String(i).padStart(2,'0'));
  for(const kind of ['books','lessons','shops','offers','regions','places','years','events','timetables','newspapers','boards','notices','chocolatecards','chocolatepools','bestiary','rarities','memories','curiosities','yearbooks','retrospectives','templates']){
   const context=(await f.master.request('/api/master/content/context')).value,shared=(await f.master.request('/api/master/workshop/context')).value;
   const payload=contentDraftDefaults(kind,context.schemas[kind].fields,shared.currentAcademicYear);payload.title='ÍNDICE '+kind;
   const r=await f.master.request('/api/master/content/'+kind,{method:'POST',body:{payload,policy,privateNotes:'SEGREDO'}});assert.equal(r.status,201,kind+': '+JSON.stringify(r.value));
  }
  for(const kind of ['items','quests','stories']){const data=new FormData();data.set('name','ÍNDICE '+kind);data.set('protagonistId','atlas');const shared=(await f.master.request('/api/master/workshop/context')).value;const request=quickCreateRequest(kind,data,shared);const created=await f.master.request(request.api,{method:'POST',body:request.body});assert.equal(created.status,201);}
  const file=(await f.master.request('/api/master/workshop/files',{method:'POST',body:{asset:'hogwarts.webp'}})).value;
  assert.equal((await f.master.request('/api/master/workshop/media',{method:'POST',body:{payload:{title:'ÍNDICE mídia',description:'',alt:'',category:'SCENERY',credit:'',academicYear:'1890–1891',presentation:'SCENE',fileId:file.id,crop:{x:0,y:0,width:100,height:100}},policy,privateNotes:'SEGREDO'}})).status,201);
  const url='/api/master/creations?q='+encodeURIComponent('ÍNDICE')+'&status=ALL';
  const first=(await f.master.request(url)).value,second=(await f.master.request(url+'&page=2')).value;
  assert.equal(first.total,52);assert.equal((await f.master.request('/api/master/creations?q=indice&status=ALL')).value.total,52);assert.equal(first.items.length,24);assert.equal(second.items.length,24);assert.equal(new Set([...first.items,...second.items].map(r=>r.kind+':'+r.id)).size,48);assert.equal(first.counts.DRAFT,52);
  const third=(await f.master.request(url+'&page=3')).value;assert.equal(third.items.length,4);assert.equal(new Set([...first.items,...second.items,...third.items].map(r=>r.kind+':'+r.id)).size,52);assert.equal((await f.master.request(url+'&page=4')).value.items.length,0);
  assert.equal((await f.master.request(url+'&kind=lessons')).value.total,1);
  assert.equal((await f.master.request('/api/master/creations?q=%25&status=ALL')).value.total,0);
  assert.ok(!JSON.stringify(first).includes('SEGREDO'));assert.ok(!JSON.stringify(first).includes('draft_json'));
  for(const actor of [f.atlas,f.eiris])assert.equal((await actor.request(url)).status,403);
  assert.equal((await f.master.request(url+'&view_as=atlas')).status,403);assert.equal((await f.client().request(url)).status,401);
  assert.equal((await f.master.request(url+'&page=-1')).status,400);
  const player=JSON.stringify((await f.atlas.request('/api/state')).value);assert.ok(!player.includes('ÍNDICE'));assert.ok(!player.includes('SEGREDO'));
 }finally{await f.close();}
});
test('publicado com rascunho alterado aparece em andamento sem substituir a revisão pública',async()=>{
 const f=await fixture();try{
  let record=await npc(f,'VERSÃO PÚBLICA');record=(await f.master.request('/api/master/workshop/npcs/'+record.id+'/publish',{method:'POST',body:{version:record.version}})).value;
  record=(await f.master.request('/api/master/workshop/npcs/'+record.id,{method:'PATCH',body:{version:record.version,payload:{...Object.fromEntries(Object.entries(record.payload).filter(([k])=>k!=='fragments')),name:'VERSÃO NOVA'},policy,privateNotes:''}})).value;
  const before=f.db.prepare('SELECT count(*) n FROM audit_log').get().n;
  const result=(await f.master.request('/api/master/creations?q=VERS%C3%83O&status=IN_PROGRESS')).value;assert.equal(result.total,1);assert.equal(result.items[0].hasUnpublishedChanges,true);assert.equal(result.items[0].id,record.id);assert.equal(result.items[0].status,'PUBLISHED');assert.ok(result.items[0].editorHref.endsWith(record.id));assert.equal(f.db.prepare('SELECT count(*) n FROM audit_log').get().n,before);
  assert.equal(JSON.parse(f.db.prepare('SELECT published_json FROM npcs WHERE id=?').get(record.id).published_json).name,'VERSÃO PÚBLICA');
 }finally{await f.close();}
});
