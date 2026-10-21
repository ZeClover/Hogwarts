import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Config } from './config.ts';
import { all, one, audit, transaction, type DB, type Row } from './db.ts';
import { fail, now, digest, requireMaster, requireSession, viewerFor, type Session, type Viewer } from './auth.ts';
import { fields, jsonBody, record, send, text, stringIds } from './http.ts';
import { exists, expected, validatePolicy, policyAllows, imageStamp, type Policy } from './editorial.ts';
import { locationVisible } from './access.ts';
import { npcReference } from './npcs.ts';
import { renderImage } from './workshop.ts';

type Domain='quests'|'stories';
type Payload={title:string;summary:string;kind:string;academicYear:string;fileId:string|null;alt:string;npcId:string|null;locationId:string|null;hook:string};
type Internal={synopsis:string;importance:string;releaseConditions:string;notes:string};
type Entry={id:string;kind:string;title:string;text:string;npcId:string|null;locationId:string|null;fileId:string|null;alt:string};
type Published=Payload&{entries?:Entry[]};
const table=(domain:Domain)=>domain==='quests'?'quests':'personal_story_arcs';
const revisionTable=(domain:Domain)=>domain==='quests'?'quest_revisions':'story_revisions';
const get=(db:DB,domain:Domain,id:string)=>one(db,`SELECT * FROM ${table(domain)} WHERE id=?`,id)??fail(404,'Registro não encontrado.');
const payload=(row:Row,published=false):Published=>JSON.parse(String(published?row.published_json:row.draft_json));
const policy=(row:Row,published=false):Policy=>JSON.parse(String(published?row.published_policy_json:row.draft_policy_json));
const privateData=(row:Row):Internal=>JSON.parse(String(row.private_json));
const entryRows=(db:DB,id:string)=>all(db,'SELECT * FROM personal_story_entries WHERE arc_id=? ORDER BY position,id',id);
const entries=(db:DB,id:string):Entry[]=>entryRows(db,id).map(r=>({id:String(r.id),...JSON.parse(String(r.draft_json))}));
const participants=(db:DB,id:string)=>all(db,'SELECT character_id,active,state,released_revision,released_at,started_at FROM quest_participants WHERE quest_id=? ORDER BY character_id',id);
const reveals=(db:DB,id:string)=>all(db,'SELECT * FROM personal_story_reveals WHERE arc_id=? ORDER BY position,entry_id',id);
function optional(db:DB,value:unknown,entity:'locations'|'workshop_files'|'npcs'){
  if(value===null)return null;const id=text(value,100);
  if(entity==='npcs'){if(!one(db,'SELECT id FROM npcs WHERE id=?',id))fail(400,'NPC indisponível.');}else exists(db,entity,id);return id;
}
function validatePayload(db:DB,value:unknown):Payload{
  const p=record(value);fields(p,['title','summary','kind','academicYear','fileId','alt','npcId','locationId','hook']);
  if(p.academicYear!=='1890–1891')fail(400,'Selecione o ano letivo disponível.');
  return {title:text(p.title,120),summary:text(p.summary,3000,false),kind:text(p.kind,80,false),academicYear:p.academicYear,
    fileId:optional(db,p.fileId,'workshop_files'),alt:text(p.alt,300,false),npcId:optional(db,p.npcId,'npcs'),locationId:optional(db,p.locationId,'locations'),hook:text(p.hook,2000,false)};
}
function validatePrivate(value:unknown):Internal{
  const p=record(value);fields(p,['synopsis','importance','releaseConditions','notes']);
  return {synopsis:text(p.synopsis,4000,false),importance:text(p.importance,200,false),releaseConditions:text(p.releaseConditions,2000,false),notes:text(p.notes,2000,false)};
}
function ready(p:{fileId:string|null;alt:string}){if(p.fileId&&!p.alt)fail(422,'Preencha o texto alternativo de cada imagem antes de preparar ou publicar.');}
function composed(db:DB,domain:Domain,row:Row):Published{return {...payload(row),...(domain==='stories'?{entries:entries(db,String(row.id))}:{})};}
function pending(db:DB,domain:Domain,row:Row){return !!row.published_json&&(JSON.stringify(composed(db,domain,row))!==row.published_json||row.draft_policy_json!==row.published_policy_json);}
function snapshot(db:DB,domain:Domain,row:Row){return {status:row.status,version:row.version,payload:payload(row),policy:policy(row),private:privateData(row),
  published:row.published_json?payload(row,true):null,publishedPolicy:row.published_policy_json?policy(row,true):null,publishedRevision:row.published_revision,
  ...(domain==='quests'?{participants:participants(db,String(row.id))}:{protagonistId:row.protagonist_id,accessActive:!!row.access_active,releasedAt:row.released_at,
    entries:entryRows(db,String(row.id)).map(r=>({id:r.id,position:r.position,payload:JSON.parse(String(r.draft_json)),privateNotes:r.private_notes})),
    reveals:reveals(db,String(row.id)).map(r=>({...r,snapshot:JSON.parse(String(r.snapshot_json)),snapshot_json:undefined}))})};}
function revision(db:DB,domain:Domain,row:Row,actor:Session,action:string){
  db.prepare(`INSERT INTO ${revisionTable(domain)}(record_id,version,actor_id,action,snapshot_json) VALUES(?,?,?,?,?)`).run(String(row.id),Number(row.version),actor.userId,action,JSON.stringify(snapshot(db,domain,row)));
  audit(db,actor.userId,`${domain==='quests'?'QUEST':'STORY'}_${action}`,domain==='quests'?'QUEST':'STORY',String(row.id),{version:row.version});
}
function adminDTO(db:DB,domain:Domain,row:Row){
  const p=payload(row),file=p.fileId?one(db,'SELECT id,origin_asset FROM workshop_files WHERE id=?',p.fileId):null;
  return {id:row.id,status:row.status,version:row.version,payload:p,policy:policy(row),private:privateData(row),publishedRevision:row.published_revision,
    hasUnpublishedChanges:pending(db,domain,row),sourceImage:file?{image:`/api/master/workshop/files/${file.id}`,originalAlreadyPublic:!!file.origin_asset}:null,
    ...(domain==='quests'?{participants:participants(db,String(row.id))}:{protagonistId:row.protagonist_id,protagonistLocked:row.released_at!==null,accessActive:!!row.access_active,
      entries:entryRows(db,String(row.id)).map(r=>({id:r.id,payload:JSON.parse(String(r.draft_json)),privateNotes:r.private_notes})),
      publishedEntryIds:row.published_json?(payload(row,true).entries??[]).map(e=>e.id):[],
      reveals:reveals(db,String(row.id)).map(r=>({entryId:r.entry_id,title:JSON.parse(String(r.snapshot_json)).title,active:!!r.active,sourceRevision:r.source_revision}))})};
}
function eligible(db:DB,viewer:Viewer,domain:Domain,row:Row,draft=false){
  return !!viewer.characterId&&(domain==='quests'||row.protagonist_id===viewer.characterId)&&policyAllows(db,viewer,policy(row,!draft));
}
function canAnnounce(db:DB,viewer:Viewer,row:Row){return row.status==='PUBLISHED'&&!!row.published_json&&eligible(db,viewer,'quests',row);}
function canRead(db:DB,viewer:Viewer,domain:Domain,row:Row){
  if(!row.published_json||!eligible(db,viewer,domain,row))return false;
  return domain==='stories'?!!row.access_active:!!one(db,'SELECT 1 FROM quest_participants WHERE quest_id=? AND character_id=? AND active=1',String(row.id),viewer.characterId!);
}
function links(db:DB,viewer:Viewer,p:{npcId:string|null;locationId:string|null}){
  const location=p.locationId?one(db,'SELECT * FROM locations WHERE id=?',p.locationId):null;
  return {npc:p.npcId?npcReference(db,viewer,p.npcId):null,location:location&&locationVisible(db,viewer,location)?{id:location.id,title:location.title}:null};
}
function entryStamp(r:Row){return digest(`${r.arc_id}:${r.entry_id}:${r.snapshot_json}`).slice(0,20);}
function project(db:DB,viewer:Viewer,domain:Domain,row:Row,{draft=false,announcement=false,imageURL}:{draft?:boolean;announcement?:boolean;imageURL?:string}={}){
  const p=payload(row,!draft),enrollment=domain==='quests'&&viewer.characterId?one(db,'SELECT state FROM quest_participants WHERE quest_id=? AND character_id=? AND active=1',String(row.id),viewer.characterId):null;
  const known=domain==='stories'&&canRead(db,viewer,domain,row)?reveals(db,String(row.id)).filter(r=>!!r.active&&r.character_id===viewer.characterId).map(r=>{
    const e:Entry=JSON.parse(String(r.snapshot_json));return {id:e.id,kind:e.kind,title:e.title,text:e.text,...links(db,viewer,e),alt:e.fileId?e.alt:'',
      image:e.fileId?`/api/campaign/stories/${row.id}/entries/${r.entry_id}/image?stamp=${entryStamp(r)}${viewer.preview?'&view_as='+encodeURIComponent(viewer.characterId!):''}`:null};
  }):[];
  return {id:row.id,title:p.title,summary:p.summary,kind:p.kind,academicYear:p.academicYear,hook:p.hook,...links(db,viewer,p),
    image:p.fileId?(imageURL??`/api/campaign/${announcement?'announcements':domain}/${row.id}/image?stamp=${imageStamp(row)}&context=${announcement?'announcement':'diary'}`):null,alt:p.fileId?p.alt:'',
    ...(announcement?{}:{archived:row.status!=='PUBLISHED',...(domain==='quests'?{state:enrollment?.state??null}:{entries:known})})};
}
function create(db:DB,domain:Domain,actor:Session,data:Record<string,unknown>){
  fields(data,domain==='quests'?['payload','policy','private']:['payload','policy','private','protagonistId']);
  const p=validatePayload(db,data.payload),rules=validatePolicy(db,data.policy),internal=validatePrivate(data.private),id=randomUUID();
  const protagonist=domain==='stories'?text(data.protagonistId,100):null;if(protagonist)exists(db,'characters',protagonist);
  return transaction(db,()=>{
    const columns=domain==='stories'?',protagonist_id':'',placeholder=domain==='stories'?',?':'';
    db.prepare(`INSERT INTO ${table(domain)}(id,owner_user_id,draft_json,draft_policy_json,private_json${columns}) VALUES(?,?,?,?,?${placeholder})`)
      .run(id,actor.userId,JSON.stringify(p),JSON.stringify(rules),JSON.stringify(internal),...(protagonist?[protagonist]:[]));
    const row=get(db,domain,id);revision(db,domain,row,actor,'CREATED');return adminDTO(db,domain,row);
  });
}
function save(db:DB,domain:Domain,actor:Session,id:string,data:Record<string,unknown>){
  fields(data,domain==='quests'?['version','payload','policy','private']:['version','payload','policy','private','protagonistId']);
  return transaction(db,()=>{
    const before=get(db,domain,id);expected(before,data.version);if(before.status==='ARCHIVED')fail(409,'Restaure o registro antes de editar.');
    const p=validatePayload(db,data.payload),rules=validatePolicy(db,data.policy),internal=validatePrivate(data.private);
    if(domain==='stories'){
      const protagonist=text(data.protagonistId,100);exists(db,'characters',protagonist);
      if(before.released_at!==null&&before.protagonist_id!==protagonist)fail(409,'O protagonista fica fixo após a primeira liberação. Duplique como novo arco para outro personagem.');
      db.prepare('UPDATE personal_story_arcs SET protagonist_id=? WHERE id=?').run(protagonist,id);
    }
    db.prepare(`UPDATE ${table(domain)} SET draft_json=?,draft_policy_json=?,private_json=?,version=version+1,status=CASE WHEN status='PREPARED' THEN 'DRAFT' ELSE status END,updated_at=? WHERE id=?`)
      .run(JSON.stringify(p),JSON.stringify(rules),JSON.stringify(internal),now(),id);
    const row=get(db,domain,id);revision(db,domain,row,actor,'SAVED');return adminDTO(db,domain,row);
  });
}
function bump(db:DB,domain:Domain,id:string){db.prepare(`UPDATE ${table(domain)} SET version=version+1,updated_at=? WHERE id=?`).run(now(),id);}
function command(db:DB,domain:Domain,actor:Session,id:string,action:string,data:Record<string,unknown>){
  fields(data,['version']);return transaction(db,()=>{
    const before=get(db,domain,id);expected(before,data.version);
    if(action==='archive'){
      if(before.status==='ARCHIVED')fail(409,'O registro já está arquivado.');db.prepare(`UPDATE ${table(domain)} SET status='ARCHIVED' WHERE id=?`).run(id);
    }else if(action==='restore'){
      if(before.status!=='ARCHIVED')fail(409,'Somente um registro arquivado pode ser restaurado.');db.prepare(`UPDATE ${table(domain)} SET status='DRAFT' WHERE id=?`).run(id);
    }else if(action==='prepare'||action==='publish'){
      if(before.status==='ARCHIVED')fail(409,'Restaure o registro antes de publicar.');const p=composed(db,domain,before);ready(p);(p.entries??[]).forEach(ready);
      if(action==='prepare'){
        if(before.status==='PUBLISHED')fail(409,'O registro já possui uma revisão publicada.');db.prepare(`UPDATE ${table(domain)} SET status='PREPARED' WHERE id=?`).run(id);
      }else db.prepare(`UPDATE ${table(domain)} SET status='PUBLISHED',published_json=?,published_policy_json=draft_policy_json,published_revision=version+1,published_at=? WHERE id=?`).run(JSON.stringify(p),now(),id);
    }else fail(404,'Ação não encontrada.');
    bump(db,domain,id);const row=get(db,domain,id);revision(db,domain,row,actor,action.toUpperCase());return adminDTO(db,domain,row);
  });
}
function duplicate(db:DB,domain:Domain,actor:Session,id:string,data:Record<string,unknown>){
  fields(data,['version']);return transaction(db,()=>{
    const before=get(db,domain,id);expected(before,data.version);const copyId=randomUUID(),p=payload(before);p.title=`${p.title.slice(0,110)} — cópia`;
    db.prepare(`INSERT INTO ${table(domain)}(id,owner_user_id,draft_json,draft_policy_json,private_json${domain==='stories'?',protagonist_id':''}) VALUES(?,?,?,?,?${domain==='stories'?',?':''})`)
      .run(copyId,actor.userId,JSON.stringify(p),String(before.draft_policy_json),String(before.private_json),...(domain==='stories'?[String(before.protagonist_id)]:[]));
    if(domain==='stories')for(const e of entryRows(db,id))db.prepare('INSERT INTO personal_story_entries(id,arc_id,position,draft_json,private_notes) VALUES(?,?,?,?,?)').run(randomUUID(),copyId,Number(e.position),String(e.draft_json),String(e.private_notes));
    const row=get(db,domain,copyId);revision(db,domain,row,actor,'DUPLICATED');return adminDTO(db,domain,row);
  });
}
function questAccess(db:DB,actor:Session,id:string,action:string,data:Record<string,unknown>){
  fields(data,['version','characters']);const characters=stringIds(data.characters);if(!characters.length)fail(400,'Selecione participantes.');characters.forEach(c=>exists(db,'characters',c));
  return transaction(db,()=>{
    const before=get(db,'quests',id);expected(before,data.version);
    if(action!=='revoke'&&before.status!=='PUBLISHED')fail(409,'Publique a missão antes desta ação.');
    for(const characterId of characters){
      const viewer:Viewer={userId:actor.userId,role:'PLAYER',characterId,preview:true};
      if(action==='release'&&!eligible(db,viewer,'quests',before))fail(422,'Um participante não atende ao público publicado. Nenhuma alteração foi aplicada.');
      if(action==='start'){
        const member=one(db,'SELECT * FROM quest_participants WHERE quest_id=? AND character_id=?',id,characterId);
        if(!canRead(db,viewer,'quests',before)||member?.state!=='AVAILABLE')fail(409,'Todos os selecionados devem ter a missão liberada e ainda não iniciada.');
      }
    }
    for(const characterId of characters){
      if(action==='release')db.prepare(`INSERT INTO quest_participants(quest_id,character_id,released_revision,actor_id) VALUES(?,?,?,?)
        ON CONFLICT(quest_id,character_id) DO UPDATE SET state=CASE WHEN active=0 THEN 'AVAILABLE' ELSE state END,started_at=CASE WHEN active=0 THEN NULL ELSE started_at END,active=1,released_revision=excluded.released_revision,actor_id=excluded.actor_id,released_at=unixepoch()`)
        .run(id,characterId,Number(before.published_revision),actor.userId);
      else if(action==='start')db.prepare("UPDATE quest_participants SET state='IN_PROGRESS',started_at=?,actor_id=? WHERE quest_id=? AND character_id=?").run(now(),actor.userId,id,characterId);
      else db.prepare('UPDATE quest_participants SET active=0,actor_id=? WHERE quest_id=? AND character_id=?').run(actor.userId,id,characterId);
    }
    bump(db,'quests',id);const row=get(db,'quests',id);revision(db,'quests',row,actor,action.toUpperCase());return adminDTO(db,'quests',row);
  });
}
function storyAccess(db:DB,actor:Session,id:string,action:string,data:Record<string,unknown>){
  fields(data,['version']);return transaction(db,()=>{
    const before=get(db,'stories',id);expected(before,data.version);
    if(action==='release'){
      const viewer:Viewer={userId:actor.userId,role:'PLAYER',characterId:String(before.protagonist_id),preview:true};
      if(before.status!=='PUBLISHED'||!eligible(db,viewer,'stories',before))fail(422,'Publique o arco e confira o acesso do protagonista antes de liberar.');
      db.prepare('UPDATE personal_story_arcs SET access_active=1,released_at=COALESCE(released_at,?) WHERE id=?').run(now(),id);
    }else db.prepare('UPDATE personal_story_arcs SET access_active=0 WHERE id=?').run(id);
    bump(db,'stories',id);const row=get(db,'stories',id);revision(db,'stories',row,actor,action.toUpperCase());return adminDTO(db,'stories',row);
  });
}
function saveEntry(db:DB,actor:Session,id:string,action:string,data:Record<string,unknown>){
  fields(data,action==='reorder'?['version','entryIds']:action==='remove'?['version','entryId']:['version','entryId','payload','privateNotes']);
  return transaction(db,()=>{
    const before=get(db,'stories',id);expected(before,data.version);if(before.status==='ARCHIVED')fail(409,'Restaure o arco antes de editar.');
    const rows=entryRows(db,id);
    if(action==='reorder'){
      const ids=stringIds(data.entryIds);if(ids.length!==(data.entryIds as unknown[]).length||ids.length!==rows.length||ids.some(e=>!rows.some(r=>r.id===e)))fail(400,'Envie a ordem completa dos capítulos.');
      ids.forEach((entry,index)=>db.prepare('UPDATE personal_story_entries SET position=? WHERE id=? AND arc_id=?').run(index,entry,id));
    }else{
      const entryId=data.entryId===null?randomUUID():text(data.entryId,100),old=rows.find(r=>r.id===entryId);
      if((action==='remove'||data.entryId!==null)&&!old)fail(404,'Capítulo não encontrado.');
      if(action==='remove')db.prepare('DELETE FROM personal_story_entries WHERE id=? AND arc_id=?').run(entryId,id);
      else{
        const p=record(data.payload);fields(p,['kind','title','text','npcId','locationId','fileId','alt']);if(!['CHAPTER','EVENT','REVELATION'].includes(String(p.kind)))fail(400,'Escolha o tipo da entrada.');
        const content={kind:p.kind,title:text(p.title,120),text:text(p.text,4000),npcId:optional(db,p.npcId,'npcs'),locationId:optional(db,p.locationId,'locations'),fileId:optional(db,p.fileId,'workshop_files'),alt:text(p.alt,300,false)},notes=text(data.privateNotes??'',2000,false);
        if(!old&&rows.length>=30)fail(400,'Use até 30 entradas por arco.');
        if(old)db.prepare('UPDATE personal_story_entries SET draft_json=?,private_notes=? WHERE id=? AND arc_id=?').run(JSON.stringify(content),notes,entryId,id);
        else db.prepare('INSERT INTO personal_story_entries(id,arc_id,position,draft_json,private_notes) VALUES(?,?,?,?,?)').run(entryId,id,rows.length?Math.max(...rows.map(r=>Number(r.position)))+1:0,JSON.stringify(content),notes);
      }
    }
    db.prepare("UPDATE personal_story_arcs SET status=CASE WHEN status='PREPARED' THEN 'DRAFT' ELSE status END WHERE id=?").run(id);
    bump(db,'stories',id);const row=get(db,'stories',id);revision(db,'stories',row,actor,`ENTRY_${action.toUpperCase()}`);return adminDTO(db,'stories',row);
  });
}
function revealEntry(db:DB,actor:Session,id:string,revoke:boolean,data:Record<string,unknown>){
  fields(data,['version','entryId']);const entryId=text(data.entryId,100);
  return transaction(db,()=>{
    const before=get(db,'stories',id);expected(before,data.version);
    if(revoke&&!one(db,'SELECT 1 FROM personal_story_reveals WHERE arc_id=? AND entry_id=?',id,entryId))fail(404,'Entrada revelada não encontrada.');
    if(revoke)db.prepare('UPDATE personal_story_reveals SET active=0,actor_id=?,updated_at=? WHERE arc_id=? AND entry_id=?').run(actor.userId,now(),id,entryId);
    else{
      const viewer:Viewer={userId:actor.userId,role:'PLAYER',characterId:String(before.protagonist_id),preview:true};
      if(before.status!=='PUBLISHED'||!canRead(db,viewer,'stories',before))fail(409,'Libere o arco publicado ao protagonista antes de revelar.');
      const prepared=payload(before,true).entries??[],position=prepared.findIndex(e=>e.id===entryId);if(position<0)fail(404,'Entrada publicada não encontrada.');const entry=prepared[position]!;ready(entry);
      db.prepare(`INSERT INTO personal_story_reveals(arc_id,entry_id,character_id,position,snapshot_json,source_revision,actor_id) VALUES(?,?,?,?,?,?,?)
        ON CONFLICT(arc_id,entry_id,character_id) DO UPDATE SET active=1,position=excluded.position,snapshot_json=excluded.snapshot_json,source_revision=excluded.source_revision,actor_id=excluded.actor_id,updated_at=unixepoch()`)
        .run(id,entryId,String(before.protagonist_id),position,JSON.stringify(entry),Number(before.published_revision),actor.userId);
    }
    bump(db,'stories',id);const row=get(db,'stories',id);revision(db,'stories',row,actor,revoke?'ENTRY_REVOKED':'ENTRY_REVEALED');return adminDTO(db,'stories',row);
  });
}
function list(db:DB,domain:Domain,url:URL,viewer?:Viewer,announcement=false){
  const q=(url.searchParams.get('q')??'').trim().toLocaleLowerCase('pt-BR').slice(0,120),status=url.searchParams.get('status'),kind=url.searchParams.get('kind');
  const rows=all(db,`SELECT * FROM ${table(domain)} ORDER BY updated_at DESC,id`).flatMap(row=>{
    if(viewer&&!(announcement?canAnnounce(db,viewer,row):canRead(db,viewer,domain,row)))return [];
    const p=payload(row,!!viewer),publicValue=viewer?project(db,viewer,domain,row,{announcement}):null,value=publicValue??adminDTO(db,domain,row);
    const known:Array<{title:string;text:string}>=publicValue&&'entries' in publicValue&&Array.isArray(publicValue.entries)?publicValue.entries:[];
    if((q&&!`${p.title} ${p.summary} ${p.hook} ${known.map(e=>e.title+' '+e.text).join(' ')}`.toLocaleLowerCase('pt-BR').includes(q))||(!viewer&&status&&row.status!==status)||(kind&&p.kind!==kind))return [];
    return [value];
  });
  const requested=Number(url.searchParams.get('page')??1),page=Number.isInteger(requested)&&requested>0&&requested<=1_000_000?requested:1;
  return {items:rows.slice((page-1)*12,page*12),total:rows.length,page,pageSize:12};
}
async function cover(db:DB,config:Config,res:ServerResponse,p:{fileId:string|null}){if(!p.fileId)fail(404,'Imagem indisponível.');await renderImage(db,config,res,{fileId:p.fileId,crop:{x:0,y:0,width:100,height:100}},false);}
export async function handleCampaign(req:IncomingMessage,res:ServerResponse,url:URL,db:DB,config:Config,session?:Session):Promise<boolean>{
  const path=url.pathname,method=req.method??'GET',admin=path.startsWith('/api/master/campaign');
  if(!admin&&!path.startsWith('/api/campaign'))return false;
  if(admin){
    const actor=requireMaster(session);if(url.searchParams.has('view_as'))fail(403,'Saia da visualização para administrar.');
    if(path==='/api/master/campaign/context'&&method==='GET'){
      send(res,200,{npcs:all(db,'SELECT id,status,draft_json FROM npcs ORDER BY id').map(r=>({id:r.id,status:r.status,name:JSON.parse(String(r.draft_json)).name}))});return true;
    }
    const match=path.match(/^\/api\/master\/campaign\/(quests|stories)(?:\/([\w-]+))?(?:\/(history|preview|preview-image|prepare|publish|duplicate|archive|restore|release|revoke|start|entries|reorder|reveal-entry|revoke-entry))?$/);
    if(match){
      const domain=match[1] as Domain,id=match[2],action=match[3];
      if(!id){if(method==='GET'){send(res,200,list(db,domain,url));return true;}if(method==='POST'){send(res,201,create(db,domain,actor,await jsonBody(req,131_072)));return true;}}
      else{
        const row=get(db,domain,id);
        if(!action&&method==='GET'){send(res,200,adminDTO(db,domain,row));return true;}
        if(!action&&method==='PATCH'){send(res,200,save(db,domain,actor,id,await jsonBody(req,131_072)));return true;}
        if(action==='history'&&method==='GET'){
          const requested=Number(url.searchParams.get('page')??1),page=Number.isSafeInteger(requested)&&requested>0&&requested<=100_000?requested:1;
          send(res,200,{items:all(db,`SELECT version,actor_id,action,snapshot_json,created_at FROM ${revisionTable(domain)} WHERE record_id=? ORDER BY version DESC LIMIT 20 OFFSET ?`,id,(page-1)*20)
            .map(r=>({version:r.version,actorId:r.actor_id,action:r.action,createdAt:r.created_at,snapshot:JSON.parse(String(r.snapshot_json))}))});return true;
        }
        if((action==='preview'||action==='preview-image')&&method==='GET'){
          const characterId=text(url.searchParams.get('character'),100);exists(db,'characters',characterId);const source=url.searchParams.get('source')??'draft',mode=url.searchParams.get('mode')??'diary';
          if(!['draft','published'].includes(source)||!['diary','announcement'].includes(mode)||(domain==='stories'&&mode==='announcement'))fail(400,'Prévia inválida.');
          const viewer:Viewer={userId:actor.userId,role:'PLAYER',characterId,preview:true},isDraft=source==='draft',announcement=mode==='announcement';
          const allowed=isDraft?row.status!=='ARCHIVED'&&eligible(db,viewer,domain,row,true):(announcement?canAnnounce(db,viewer,row):canRead(db,viewer,domain,row));
          const imageURL=`/api/master/campaign/${domain}/${id}/preview-image?character=${encodeURIComponent(characterId)}&source=${source}&mode=${mode}&version=${row.version}`;
          if(action==='preview'){send(res,200,{accessible:allowed,preview:true,inDiary:canRead(db,viewer,domain,row),record:allowed?project(db,viewer,domain,row,{draft:isDraft,announcement,imageURL}):null});return true;}
          if(!allowed||String(row.version)!==url.searchParams.get('version'))fail(404,'Imagem indisponível.');await cover(db,config,res,payload(row,!isDraft));return true;
        }
        if(method==='POST'){
          const data=await jsonBody(req);
          if(action==='duplicate'){send(res,200,duplicate(db,domain,actor,id,data));return true;}
          if(action&&['prepare','publish','archive','restore'].includes(action)){send(res,200,command(db,domain,actor,id,action,data));return true;}
          if(action&&['release','revoke','start'].includes(action)&&(domain==='quests'||action!=='start')){send(res,200,domain==='quests'?questAccess(db,actor,id,action,data):storyAccess(db,actor,id,action,data));return true;}
          if(domain==='stories'&&(action==='entries'||action==='reorder')){send(res,200,saveEntry(db,actor,id,action==='entries'?'save':'reorder',data));return true;}
          if(domain==='stories'&&(action==='reveal-entry'||action==='revoke-entry')){send(res,200,revealEntry(db,actor,id,action==='revoke-entry',data));return true;}
        }
        if(domain==='stories'&&action==='entries'&&method==='DELETE'){send(res,200,saveEntry(db,actor,id,'remove',await jsonBody(req)));return true;}
      }
    }
    fail(404,'Recurso não encontrado.');
  }
  const viewer=viewerFor(db,requireSession(session),url);
  const match=path.match(/^\/api\/campaign\/(quests|stories|announcements)(?:\/([\w-]+))?(?:\/(image)|\/entries\/([\w-]+)\/image)?$/);
  if(match&&method==='GET'){
    const domain:Domain=match[1]==='stories'?'stories':'quests',announcement=match[1]==='announcements',id=match[2];
    if(!id){send(res,200,list(db,domain,url,viewer,announcement));return true;}
    const row=get(db,domain,id);
    if(!(announcement?canAnnounce(db,viewer,row):canRead(db,viewer,domain,row)))fail(404,'Registro não encontrado.');
    if(match[4]){
      if(domain!=='stories'||announcement)fail(404,'Imagem indisponível.');
      const known=one(db,'SELECT * FROM personal_story_reveals WHERE arc_id=? AND entry_id=? AND character_id=? AND active=1',id,match[4],viewer.characterId!);
      if(!known||url.searchParams.get('stamp')!==entryStamp(known))fail(404,'Imagem indisponível.');await cover(db,config,res,JSON.parse(String(known.snapshot_json)));return true;
    }
    if(match[3]){
      const context=url.searchParams.get('context');if(context==='announcement'){
        if(domain!=='quests'||!canAnnounce(db,viewer,row))fail(404,'Imagem indisponível.');
      }else if(context!=='diary'||!canRead(db,viewer,domain,row))fail(404,'Imagem indisponível.');
      if(url.searchParams.get('stamp')!==imageStamp(row))fail(404,'Imagem indisponível.');await cover(db,config,res,payload(row,true));return true;
    }
    send(res,200,project(db,viewer,domain,row,{announcement}));return true;
  }
  fail(404,'Recurso não encontrado.');
}
