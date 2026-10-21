import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile, writeFile, unlink, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { Config } from './config.ts';
import { all, one, audit, transaction, type DB, type Row } from './db.ts';
import { fail, HttpError, requireMaster, requireSession, viewerFor, rateLimit, type Session, type Viewer } from './auth.ts';
import { bodyBuffer, jsonBody, send, text, fields, stringIds } from './http.ts';
import { adminMedia, command, createEntry, editEntry, entry, expected, exists, draft, published, policy, policyAllows,
  publicMedia, imageStamp, categories, presentations, type MediaPayload } from './editorial.ts';

async function approvedAssets(config:Config){return (await readdir(join(config.publicDir,'assets'))).filter(name=>name.endsWith('.webp')).sort();}
function fileDTO(row:Row){return {id:row.id,width:row.width,height:row.height,originalAlreadyPublic:!!row.origin_asset,image:`/api/master/workshop/files/${row.id}`};}
function imageMime(bytes:Buffer){
  if(bytes.subarray(0,3).equals(Buffer.from([255,216,255])))return 'image/jpeg';
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';
  return null;
}
async function storeImage(db:DB,config:Config,actor:Session,bytes:Buffer,source:string|null){
  let output:Buffer;
  try{
    const decoder=sharp(bytes,{limitInputPixels:16_000_000,animated:false,failOn:'warning'}),meta=await decoder.metadata();
    if(!['jpeg','png','webp'].includes(meta.format??'')||(meta.pages??1)>1)fail(415,'Use uma imagem JPG, PNG ou WebP estática.');
    output=await decoder.autoOrient().resize(2048,2048,{fit:'inside',withoutEnlargement:true}).webp({quality:88}).toBuffer();
  }catch(error){if(error instanceof HttpError)throw error;fail(400,'Não foi possível ler essa imagem.');}
  const meta=await sharp(output).metadata(),id=randomUUID(),key=`${id}.webp`,path=join(config.dataDir,'media',key);
  await writeFile(path,output,{mode:0o600,flag:'wx'});
  try{
    transaction(db,()=>{
      db.prepare('INSERT INTO workshop_files(id,owner_user_id,storage_key,mime,bytes,width,height,origin_asset) VALUES(?,?,?,?,?,?,?,?)')
        .run(id,actor.userId,key,'image/webp',output.length,meta.width!,meta.height!,source);
      audit(db,actor.userId,'WORKSHOP_FILE_UPLOADED','MEDIA_FILE',id);
    });
  }catch(error){await unlink(path).catch(()=>{});throw error;}
  return fileDTO(one(db,'SELECT * FROM workshop_files WHERE id=?',id)!);
}
async function renderImage(db:DB,config:Config,res:ServerResponse,payload:MediaPayload,thumb:boolean){
  const file=one(db,'SELECT * FROM workshop_files WHERE id=?',payload.fileId)??fail(404,'Imagem indisponível.');
  const width=Number(file.width),height=Number(file.height),crop=payload.crop;
  const left=Math.min(width-1,Math.floor(width*crop.x/100)),top=Math.min(height-1,Math.floor(height*crop.y/100));
  const cropWidth=Math.max(1,Math.min(width-left,Math.floor(width*crop.width/100)));
  const cropHeight=Math.max(1,Math.min(height-top,Math.floor(height*crop.height/100)));
  const buffer=await readFile(join(config.dataDir,'media',basename(String(file.storage_key))));
  const bytes=await sharp(buffer).extract({left,top,width:cropWidth,height:cropHeight})
    .resize(thumb?480:1600,thumb?480:1600,{fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
  res.writeHead(200,{'Content-Type':'image/webp','Content-Disposition':'inline; filename="imagem.webp"'});res.end(bytes);
}
function canRead(db:DB,viewer:Viewer,row:Row){return row.status==='PUBLISHED'&&!!row.published_json&&(viewer.role==='MASTER'||policyAllows(db,viewer,policy(row,true)));}
function listEntries(db:DB,url:URL,viewer?:Viewer){
  const q=(url.searchParams.get('q')??'').trim().toLocaleLowerCase('pt-BR').slice(0,120),category=url.searchParams.get('category'),year=url.searchParams.get('year'),status=url.searchParams.get('status');
  const rows=all(db,'SELECT * FROM editorial_entries ORDER BY updated_at DESC,id').filter(row=>{
    if(viewer&&!canRead(db,viewer,row))return false;
    const payload=viewer?published(row):draft(row);
    return (!q||`${payload.title} ${payload.description}`.toLocaleLowerCase('pt-BR').includes(q))&&(!category||payload.category===category)&&(!year||payload.academicYear===year)&&(!status||!!viewer||row.status===status);
  });
  const rawPage=Number(url.searchParams.get('page')??1),page=Number.isInteger(rawPage)&&rawPage>=1&&rawPage<=1_000_000?rawPage:1;
  return {total:rows.length,page,pageSize:12,items:rows.slice((page-1)*12,page*12).map(row=>viewer?publicMedia(row):{
    id:row.id,title:draft(row).title,category:draft(row).category,status:row.status,version:row.version,
    hasUnpublishedChanges:!!row.published_revision&&row.published_revision!==row.version,
    image:`/api/master/workshop/media/${row.id}/image?version=${row.version}&variant=thumb`})};
}
function previewViewer(db:DB,actor:Session,url:URL):Viewer {
  const character=url.searchParams.get('character');if(!character)fail(400,'Escolha um personagem para a prévia.');exists(db,'characters',character);
  return {userId:actor.userId,role:'PLAYER',characterId:character,preview:true};
}
export async function handleWorkshop(req:IncomingMessage,res:ServerResponse,url:URL,db:DB,config:Config,session?:Session):Promise<boolean>{
  const path=url.pathname,method=req.method??'GET';
  if(!path.startsWith('/api/master/workshop/')&&!path.startsWith('/api/workshop/'))return false;
  if(path.startsWith('/api/master/workshop/')){
    const actor=requireMaster(session);if(url.searchParams.has('view_as'))fail(403,'Saia da visualização para administrar.');
    if(path==='/api/master/workshop/context'&&method==='GET'){
      send(res,200,{categories,presentations,approvedAssets:await approvedAssets(config),
        authors:all(db,"SELECT id,email FROM users WHERE role='MASTER'"),
        characters:all(db,'SELECT id,name,house_id,school_year FROM characters'),houses:all(db,'SELECT id,name FROM houses'),
        groups:all(db,'SELECT id,name FROM access_groups'),regions:all(db,'SELECT id,title FROM regions'),locations:all(db,'SELECT id,title,region_id FROM locations'),
        cohorts:all(db,'SELECT * FROM school_cohorts').map(c=>({...c,members:all(db,'SELECT character_id FROM cohort_members WHERE cohort_id=?',String(c.id)).map(m=>m.character_id)})),
        files:all(db,'SELECT * FROM workshop_files ORDER BY created_at DESC,id').map(fileDTO)});return true;
    }
    if(path==='/api/master/workshop/files'&&method==='POST'){
      rateLimit(db,`library-upload:${actor.userId}`,60);
      let buffer:Buffer,source:string|null=null;
      if(req.headers['content-type']?.split(';')[0]==='application/json'){
        const data=await jsonBody(req);fields(data,['asset']);source=text(data.asset,100);
        if(!(await approvedAssets(config)).includes(source))fail(400,'Selecione uma imagem V4 disponível.');
        buffer=await readFile(join(config.publicDir,'assets',source));
      }else{
        buffer=await bodyBuffer(req,2*1024*1024);
        const mime=imageMime(buffer);if(!mime||mime!==req.headers['content-type'])fail(415,'O conteúdo precisa corresponder a uma imagem JPG, PNG ou WebP.');
      }
      send(res,201,await storeImage(db,config,actor,buffer,source));return true;
    }
    const file=path.match(/^\/api\/master\/workshop\/files\/([\w-]+)$/);
    if(file&&method==='GET'){
      const row=one(db,'SELECT * FROM workshop_files WHERE id=?',file[1]!)??fail(404,'Arquivo não encontrado.');
      const bytes=await readFile(join(config.dataDir,'media',basename(String(row.storage_key))));
      res.writeHead(200,{'Content-Type':'image/webp','Content-Disposition':'inline; filename="original.webp"'});res.end(bytes);return true;
    }
    const cohort=path.match(/^\/api\/master\/workshop\/cohorts(?:\/([\w-]+))?$/);
    if(cohort&&((method==='POST'&&!cohort[1])||(method==='PATCH'&&cohort[1]))){
      const data=await jsonBody(req);fields(data,['version','name','members']);
      const name=text(data.name,80),members=stringIds(data.members);members.forEach(id=>exists(db,'characters',id));
      const id=cohort[1]??randomUUID();
      transaction(db,()=>{
        if(cohort[1]){const before=one(db,'SELECT * FROM school_cohorts WHERE id=?',id)??fail(404,'Turma não encontrada.');expected(before,data.version);
          db.prepare('UPDATE school_cohorts SET name=?,version=version+1 WHERE id=?').run(name,id);
        }else db.prepare('INSERT INTO school_cohorts(id,name) VALUES(?,?)').run(id,name);
        db.prepare('DELETE FROM cohort_members WHERE cohort_id=?').run(id);
        members.forEach(c=>db.prepare('INSERT INTO cohort_members(cohort_id,character_id) VALUES(?,?)').run(id,c));
        audit(db,actor.userId,'COHORT_UPDATED','COHORT',id,{members});
      });
      send(res,200,{id});return true;
    }
    if(path==='/api/master/workshop/media'){
      if(method==='GET'){send(res,200,listEntries(db,url));return true;}
      if(method==='POST'){send(res,201,createEntry(db,actor,await jsonBody(req)));return true;}
    }
    const match=path.match(/^\/api\/master\/workshop\/media\/([\w-]+)(?:\/(history|image|preview|preview-image|prepare|publish|duplicate|archive|restore))?$/);
    if(match){
      const id=match[1]!,action=match[2],row=entry(db,id);
      if(!action&&method==='GET'){send(res,200,adminMedia(db,row));return true;}
      if(!action&&method==='PATCH'){send(res,200,editEntry(db,actor,id,await jsonBody(req)));return true;}
      if(action==='history'&&method==='GET'){
        send(res,200,{items:all(db,'SELECT version,actor_id,action,snapshot_json,created_at FROM editorial_revisions WHERE entry_id=? ORDER BY version DESC LIMIT 100',id)
          .map(r=>({version:r.version,actorId:r.actor_id,action:r.action,createdAt:r.created_at,snapshot:JSON.parse(String(r.snapshot_json))}))});return true;
      }
      if(action==='image'&&method==='GET'){
        if(String(row.version)!==url.searchParams.get('version'))fail(404,'Prévia desatualizada.');
        await renderImage(db,config,res,draft(row),url.searchParams.get('variant')==='thumb');return true;
      }
      if((action==='preview'||action==='preview-image')&&method==='GET'){
        const viewer=previewViewer(db,actor,url),source=url.searchParams.get('source')??'draft';
        if(!['draft','published'].includes(source))fail(400,'Versão de prévia inválida.');
        const isPublished=source==='published',allowed=(isPublished?canRead(db,viewer,row):row.status!=='ARCHIVED'&&policyAllows(db,viewer,policy(row)));
        if(action==='preview'){
          const image=`/api/master/workshop/media/${id}/preview-image?character=${encodeURIComponent(viewer.characterId!)}&source=${source}&version=${row.version}`;
          send(res,200,{accessible:allowed,preview:true,media:allowed?publicMedia(row,isPublished?published(row):draft(row),image):null});return true;
        }
        if(!allowed||String(row.version)!==url.searchParams.get('version'))fail(404,'Imagem indisponível.');
        await renderImage(db,config,res,isPublished?published(row):draft(row),false);return true;
      }
      if(action&&['prepare','publish','duplicate','archive','restore'].includes(action)&&method==='POST'){
        send(res,200,command(db,actor,id,action,await jsonBody(req)));return true;
      }
    }
    fail(404,'Recurso não encontrado.');
  }
  const viewer=viewerFor(db,requireSession(session),url);
  if(path==='/api/workshop/media'&&method==='GET'){send(res,200,listEntries(db,url,viewer));return true;}
  const match=path.match(/^\/api\/workshop\/media\/([\w-]+)(?:\/(image))?$/);
  if(match&&method==='GET'){
    const row=entry(db,match[1]!);if(!canRead(db,viewer,row))fail(404,'Registro não encontrado.');
    if(match[2]){
      if(url.searchParams.get('stamp')!==imageStamp(row))fail(404,'Imagem indisponível.');
      await renderImage(db,config,res,published(row),url.searchParams.get('variant')==='thumb');return true;
    }
    send(res,200,publicMedia(row));return true;
  }
  fail(404,'Recurso não encontrado.');
}
