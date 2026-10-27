import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {contentDraftDefaults,quickCreateRequest} from '../public/quick-create.js';
const policy={audience:'ALL',characters:[],groups:[],houses:[],schoolYears:[],cohorts:[],excludedCharacters:[],regionId:null,locationId:null};
const root=k=>'/api/master/content/'+k;
async function body(f,k,title='',extra={}){const context=(await f.master.request('/api/master/content/context')).value,year=(await f.master.request('/api/state')).value.calendar.academicYear;return {payload:{...contentDraftDefaults(k,context.schemas[k].fields,year),title,...extra},policy,privateNotes:'NOTA PRIVADA'};}
async function create(f,k,title,extra={}){const input=await body(f,k,title,extra),r=await f.master.request(root(k),{method:'POST',body:input});assert.equal(r.status,201,JSON.stringify(r.value));return r.value;}
async function publish(f,k,r){const p=await f.master.request(root(k)+'/'+r.id+'/publish',{method:'POST',body:{version:r.version}});assert.equal(p.status,200,JSON.stringify(p.value));return p.value;}

test('oito oficinas persistem rascunhos mínimos; Profeta vazio não inventa edição e publicação é explícita',async()=>{
 const f=await fixture();try{
  const calendar=(await f.master.request('/api/state')).value.calendar;
  for(const k of ['newspapers','boards','notices','years','events','timetables','yearbooks','retrospectives']){
   const r=await create(f,k,k==='newspapers'?'':'PRIVADO '+k);assert.equal(r.status,'DRAFT');
   assert.equal((await f.atlas.request('/api/content/'+k+'/'+r.id)).status,404);
   assert.ok(!(await f.atlas.request('/api/state')).value.news.some(n=>n.id===r.id));
   if('academicYear' in r.payload)assert.equal(r.payload.academicYear,calendar.academicYear);
   if(['newspapers','boards','notices','years','retrospectives'].includes(k))for(const action of ['prepare','publish'])assert.equal((await f.master.request(root(k)+'/'+r.id+'/'+action,{method:'POST',body:{version:r.version}})).status,422);
   if(k==='newspapers'){assert.equal(r.payload.headline,'');assert.equal(r.payload.number,'');assert.equal(r.payload.narrativeDate,'');assert.deepEqual(r.payload.articles,[]);}
  }
  assert.deepEqual((await f.master.request('/api/state')).value.calendar,calendar);
  assert.equal(f.db.prepare('SELECT count(*) n FROM delivery_events').get().n,0);
  // Newspaper's draft-only relaxation must not mutate the shared book schemas.
  const bad=await body(f,'yearbooks','');assert.equal((await f.master.request(root('yearbooks'),{method:'POST',body:bad})).status,400);
 }finally{await f.close();}
});

test('retrospectiva sem dono pode ser salva, mas somente o titular recebe a publicação',async()=>{
 const f=await fixture();try{
  let r=await create(f,'retrospectives','RETROSPECTIVA SECRETA');assert.equal(r.payload.characterId,null);
  const input=await body(f,'retrospectives',r.payload.title,{characterId:'atlas'});r=(await f.master.request(root('retrospectives')+'/'+r.id,{method:'PATCH',body:{version:r.version,...input}})).value;
  const before=f.db.prepare('SELECT count(*) n FROM audit_log').get().n;
  for(const ch of ['atlas','eiris']){const p=await f.master.request(root('retrospectives')+'/'+r.id+'/preview?character='+ch+'&source=draft');assert.equal(p.status,ch==='atlas'?200:404);}
  assert.equal(f.db.prepare('SELECT count(*) n FROM audit_log').get().n,before);
  r=await publish(f,'retrospectives',r);assert.equal((await f.atlas.request('/api/content/retrospectives/'+r.id)).status,200);assert.equal((await f.eiris.request('/api/content/retrospectives/'+r.id)).status,404);
  assert.deepEqual(f.db.prepare("SELECT character_id FROM delivery_events WHERE resource_id=?").all(r.id).map(r=>r.character_id),['atlas']);
 }finally{await f.close();}
});

test('ano novo não avança calendário e grade incompleta salva sem publicar horário inventado',async()=>{
 const f=await fixture();try{
  const original=(await f.master.request('/api/state')).value.calendar;
  let y=await create(f,'years','Próximo ano');y=(await f.master.request(root('years')+'/'+y.id,{method:'PATCH',body:{version:y.version,...await body(f,'years','Próximo ano',{startYear:1891})}})).value;await publish(f,'years',y);
  assert.deepEqual((await f.atlas.request('/api/state')).value.calendar,original);
  let r=await create(f,'timetables','GRADE EM PREPARAÇÃO',{slots:[{id:'',day:'Segunda-feira',time:'',subject:'',npcId:null,locationId:null,lessonId:null}]});
  assert.equal((await f.master.request(root('timetables')+'/'+r.id+'/publish',{method:'POST',body:{version:r.version}})).status,422);
  r=(await f.master.request(root('timetables')+'/'+r.id,{method:'PATCH',body:{version:r.version,...await body(f,'timetables',r.payload.title,{slots:[{...r.payload.slots[0],time:'08h',subject:'Matéria escrita'}]})}})).value;await publish(f,'timetables',r);
  const slots=(await f.atlas.request('/api/calendar')).value.timetables[0].table.rows;assert.deepEqual(slots,[['Segunda-feira','08h','Matéria escrita','','']]);
 }finally{await f.close();}
});

test('novidades usa snapshots publicados e autorização real, sem missões não reveladas ou avisos de mural fechado',async()=>{
 const f=await fixture();try{
  const paper=await publish(f,'newspapers',await create(f,'newspapers','JORNAL PUBLICADO',{number:'Edição escrita',headline:'MANCHETE PUBLICADA'}));
  const event=await publish(f,'events',await create(f,'events','EVENTO PUBLICADO'));
  await publish(f,'events',await create(f,'events','OUTRO EVENTO PUBLICADO'));
  await publish(f,'events',await create(f,'events','MODELO OCULTO',{isTemplate:true}));
  const board=await publish(f,'boards',await create(f,'boards','MURAL',{locationId:'biblioteca'}));
  const notice=await publish(f,'notices',await create(f,'notices','AVISO VISÍVEL',{boardId:board.id}));
  const qbody=quickCreateRequest('quests',new Map([['name','MISSÃO REVELADA']]),{currentAcademicYear:'1890–1891'}).body;qbody.policy={...policy};
  let q=(await f.master.request('/api/master/campaign/quests',{method:'POST',body:qbody})).value;q=(await f.master.request('/api/master/campaign/quests/'+q.id+'/publish',{method:'POST',body:{version:q.version}})).value;
  for(const c of [f.atlas,f.eiris])assert.ok(!(await c.request('/api/state')).value.news.some(n=>n.id===q.id));
  q=(await f.master.request('/api/master/campaign/quests/'+q.id+'/release',{method:'POST',body:{version:q.version,characters:['atlas']}})).value;
  let news=(await f.atlas.request('/api/state')).value.news;for(const r of [paper,notice,q])assert.ok(news.some(n=>n.id===r.id));assert.ok(!news.some(n=>n.id===event.id));assert.ok(!JSON.stringify(news).includes('MODELO OCULTO'));
  assert.ok(!(await f.eiris.request('/api/state')).value.news.some(n=>n.id===q.id));
  assert.deepEqual(Object.keys(news[0]).sort(),['href','id','kind','title']);
  f.db.prepare('UPDATE content_records SET updated_at=1 WHERE id=?').run(paper.id);f.db.prepare('UPDATE content_revisions SET created_at=1 WHERE record_id=? AND version=?').run(paper.id,paper.publishedRevision);
  const orderBefore=(await f.atlas.request('/api/state')).value.news.map(n=>n.id);
  await f.master.request(root('newspapers')+'/'+paper.id,{method:'PATCH',body:{version:paper.version,...await body(f,'newspapers','TÍTULO AINDA PRIVADO',{number:'2',headline:'NOVA MANCHETE'})}});
  f.db.prepare('UPDATE content_records SET updated_at=2147483647 WHERE id=?').run(paper.id);
  const afterPrivateEdit=(await f.atlas.request('/api/state')).value.news;assert.ok(!afterPrivateEdit.some(n=>n.title==='TÍTULO AINDA PRIVADO'));assert.deepEqual(afterPrivateEdit.map(n=>n.id),orderBefore);
  f.db.prepare('UPDATE content_records SET updated_at=1 WHERE id=?').run(event.id);f.db.prepare('UPDATE content_revisions SET created_at=1 WHERE record_id=? AND version=?').run(event.id,event.publishedRevision);
  const publicList=(await f.atlas.request('/api/content/events')).value.items.map(n=>n.id);assert.equal(publicList.at(-1),event.id);
  f.db.prepare('UPDATE content_records SET updated_at=2147483647 WHERE id=?').run(event.id);
  assert.deepEqual((await f.atlas.request('/api/content/events')).value.items.map(n=>n.id),publicList);
  await f.master.request(root('boards')+'/'+board.id+'/archive',{method:'POST',body:{version:board.version}});
  news=(await f.atlas.request('/api/state')).value.news;assert.ok(!news.some(n=>n.id===notice.id));
  assert.equal((await f.atlas.request('/api/content/notices/'+notice.id)).status,404);
 }finally{await f.close();}
});
