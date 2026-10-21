import { createServer, type ServerResponse } from 'node:http';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { extname, join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { configuration, type Config } from './config.ts';
import { openDatabase, one, all, transaction, audit, type DB, type Row } from './db.ts';
import { HttpError, fail, token, digest, email, now, validPassword, hashPassword, verifyPassword,
  sessionFrom, createSession, clearSession, requireSession, requireMaster, viewerFor, mutationGuard, rateLimit, type Session } from './auth.ts';
import { portalState, locationVisible, locationDTO, characterDTO, mediaVisible, publicationVisible } from './access.ts';

import { bodyBuffer, jsonBody, send, text } from './http.ts';
import { handleWorkshop } from './workshop.ts';
const imageFiles = new Set(['loja_tomos_pergaminhos.webp','loja_olivaras.webp','loja_dedosdemel.webp','loja_pocoes.webp',
  'biblioteca_hogwarts.webp','hogwarts_corredor_velas.webp','hogwarts_escadarias.webp','antiquario_ou_oficina.webp']);
function known(db: DB, table: 'characters' | 'access_groups' | 'regions' | 'locations', id: string): Row {
  // Table names are fixed internal enums, never request text.
  return one(db,`SELECT * FROM ${table} WHERE id=?`,id) ?? fail(404,'Registro não encontrado.');
}
function ids(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 100 || value.some(v=>typeof v !== 'string' || v.length > 100)) fail(400,'Destinatários inválidos.');
  return [...new Set(value as string[])];
}
function setGrants(db: DB, type: string, id: string, data: Record<string,unknown>) {
  const characters = ids(data.characters), groups = ids(data.groups);
  characters.forEach(c=>known(db,'characters',c)); groups.forEach(g=>known(db,'access_groups',g));
  db.prepare('DELETE FROM access_grants WHERE resource_type=? AND resource_id=?').run(type,id);
  for (const c of characters) db.prepare('INSERT INTO access_grants(id,resource_type,resource_id,character_id) VALUES(?,?,?,?)').run(randomUUID(),type,id,c);
  for (const g of groups) db.prepare('INSERT INTO access_grants(id,resource_type,resource_id,group_id) VALUES(?,?,?,?)').run(randomUUID(),type,id,g);
}
function audience(value: unknown) {
  if (value !== 'ALL' && value !== 'SELECTED') fail(400,'Escolha os destinatários.');
  return value;
}
function boolean(value: unknown) {
  if (typeof value !== 'boolean') fail(400,'Estado inválido.');
  return Number(value);
}
function grantsFor(db: DB, type: string, id: string) {
  const rows = all(db,'SELECT character_id,group_id FROM access_grants WHERE resource_type=? AND resource_id=?',type,id);
  return { characters:rows.filter(r=>r.character_id).map(r=>r.character_id), groups:rows.filter(r=>r.group_id).map(r=>r.group_id) };
}
function adminState(db: DB) {
  return {
    characters:all(db,'SELECT id FROM characters').map(c=>({ ...characterDTO(db,String(c.id)),
      account:one(db,'SELECT id,email,disabled FROM users WHERE character_id=?',String(c.id)) ?? null })),
    houses:all(db,'SELECT * FROM houses'),
    regions:all(db,'SELECT * FROM regions').map(r=>({...r,...grantsFor(db,'REGION',String(r.id))})),
    locations:all(db,'SELECT * FROM locations').map(r=>({...r,...grantsFor(db,'LOCATION',String(r.id))})),
    groups:all(db,'SELECT * FROM access_groups').map(r=>({...r,members:all(db,'SELECT character_id FROM group_members WHERE group_id=?',String(r.id)).map(m=>m.character_id)})),
    invites:all(db,'SELECT id,email,role,character_id,expires_at,used_at,revoked_at FROM invites ORDER BY expires_at DESC LIMIT 100'),
    audit:all(db,'SELECT * FROM audit_log ORDER BY id DESC LIMIT 100'),
    images:[...imageFiles],
  };
}
function profileTarget(db: DB, session: Session, url: URL) {
  const id = url.searchParams.get('character') ?? session.characterId;
  if (!id) fail(400,'Escolha um personagem.');
  if (session.role !== 'MASTER' && id !== session.characterId) fail(403,'Você pode editar apenas seu perfil.');
  known(db,'characters',id);
  return id;
}
function headers(res: ServerResponse, secure: boolean) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  // Dynamic style attributes are limited to curated asset URLs/map coordinates; scripts stay external.
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  if (secure) res.setHeader('Strict-Transport-Security','max-age=31536000');
}

export function createApplication(config: Config = configuration(), suppliedDb?: DB) {
  const db = suppliedDb ?? openDatabase(config);
  let activeHashes = 0;
  const server = createServer(async (req, res) => {
    headers(res,config.secure);
    try {
      const url = new URL(req.url ?? '/',config.origin);
      const path = url.pathname, method = req.method ?? 'GET';
      if (url.origin !== config.origin) fail(400,'Solicitação inválida.');
      const session = sessionFrom(db,req,config);
      const mutating = !['GET','HEAD','OPTIONS'].includes(method);
      if (mutating) mutationGuard(req,config,session,url);
      if (method === 'POST' && ['/api/auth/login','/api/auth/activate'].includes(path)) {
        if (session) fail(409,'Saia da conta antes de iniciar outra sessão.');
        rateLimit(db,`auth:${req.socket.remoteAddress ?? 'local'}`);
        const data = await jsonBody(req);
        const address = email(data.email), password = validPassword(data.password);
        rateLimit(db,`account:${address}`,10);
        if (activeHashes >= 4) fail(429,'Aguarde um instante e tente novamente.');
        activeHashes++;
        try {
          if (path.endsWith('/login')) {
            const user = one(db,'SELECT * FROM users WHERE email=?',address);
            const valid = await verifyPassword(password,user?.password_hash as string | undefined);
            if (!valid || !user || user.disabled) fail(401,'E-mail ou senha inválidos.');
            createSession(db,res,config,String(user.id));
          } else {
            const invitation = typeof data.token === 'string' && data.token.length === 64
              ? one(db,'SELECT * FROM invites WHERE token_hash=?',digest(data.token)) : undefined;
            const valid = (invite: Row | undefined) => invite && !invite.used_at && !invite.revoked_at && Number(invite.expires_at)>now() && invite.email === address;
            if (!valid(invitation)) fail(400,'Convite inválido, expirado ou já utilizado.');
            const passwordHash = await hashPassword(password), userId = randomUUID();
            transaction(db,()=>{
              const fresh = one(db,'SELECT * FROM invites WHERE id=?',String(invitation!.id));
              if (!valid(fresh) || one(db,'SELECT id FROM users WHERE email=? OR (character_id IS NOT NULL AND character_id=?)',address,fresh!.character_id ?? null)) fail(409,'Este convite não está mais disponível.');
              db.prepare('INSERT INTO users(id,email,password_hash,role,character_id) VALUES(?,?,?,?,?)').run(userId,address,passwordHash,String(fresh!.role),fresh!.character_id ?? null);
              db.prepare('UPDATE invites SET used_at=? WHERE id=?').run(now(),String(fresh!.id));
              audit(db,userId,'INVITE_ACCEPTED','INVITE',String(fresh!.id));
            });
            createSession(db,res,config,userId);
          }
        } finally { activeHashes--; }
        return send(res,200,{ok:true});
      }
      if (path === '/api/auth/logout' && method === 'POST') {
        const actor = requireSession(session);
        db.prepare('DELETE FROM sessions WHERE token_hash=?').run(actor.hash);
        clearSession(res,config); return send(res,200,{ok:true});
      }
      if (path === '/api/session' && method === 'GET') {
        const actor = requireSession(session);
        return send(res,200,{role:actor.role,csrf:actor.csrf,characterId:actor.characterId});
      }
      if (await handleWorkshop(req,res,url,db,config,session)) return;
      if (path.startsWith('/api/master/')) {
        const actor = requireMaster(session);
        if (url.searchParams.has('view_as')) fail(403,'Saia da visualização para administrar.');
        if (path === '/api/master/state' && method === 'GET') return send(res,200,adminState(db));
        const match = path.match(/^\/api\/master\/(regions|locations|characters|groups|invites|accounts)\/([a-zA-Z0-9-]+)$/);
        if (path === '/api/master/invites' && method === 'POST') {
          const data = await jsonBody(req), address = email(data.email);
          const role = data.role === 'MASTER' ? 'MASTER' : data.role === 'PLAYER' ? 'PLAYER' : fail(400,'Papel inválido.');
          const character = role === 'PLAYER' ? text(data.characterId,100) : null;
          if (character) known(db,'characters',character);
          if (one(db,'SELECT id FROM users WHERE email=? OR (character_id IS NOT NULL AND character_id=?)',address,character)) fail(409,'Já existe uma conta para este e-mail ou personagem.');
          const raw = token(), id = randomUUID();
          transaction(db,()=>{
            db.prepare('UPDATE invites SET revoked_at=? WHERE used_at IS NULL AND revoked_at IS NULL AND (email=? OR (character_id IS NOT NULL AND character_id=?))').run(now(),address,character);
            db.prepare('INSERT INTO invites(id,token_hash,email,role,character_id,expires_at,created_by) VALUES(?,?,?,?,?,?,?)').run(id,digest(raw),address,role,character,now()+259200,actor.userId);
            audit(db,actor.userId,'INVITE_CREATED','INVITE',id,{role,character});
          });
          return send(res,201,{id,url:`${config.origin}/ativar#convite=${raw}`,expiresInHours:72});
        }
        if (match?.[1] === 'invites' && method === 'DELETE') {
          const id = match[2]!;
          if (!one(db,'SELECT id FROM invites WHERE id=?',id)) fail(404,'Convite não encontrado.');
          transaction(db,()=>{db.prepare('UPDATE invites SET revoked_at=? WHERE id=? AND used_at IS NULL').run(now(),id);audit(db,actor.userId,'INVITE_REVOKED','INVITE',id);});
          return send(res,200,{ok:true});
        }
        if (match?.[1] === 'accounts' && method === 'PATCH') {
          const id = match[2]!, data = await jsonBody(req);
          const user = one(db,"SELECT id FROM users WHERE id=? AND role='PLAYER'",id);
          if (!user) fail(404,'Conta de jogador não encontrada.');
          const disabled = boolean(data.disabled);
          transaction(db,()=>{
            db.prepare('UPDATE users SET disabled=? WHERE id=?').run(disabled,id);
            db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
            audit(db,actor.userId,disabled?'ACCOUNT_DISABLED':'ACCOUNT_ENABLED','USER',id);
          });
          return send(res,200,{ok:true});
        }
        if ((path === '/api/master/groups' && method === 'POST') || (match?.[1] === 'groups' && method === 'PATCH')) {
          const data = await jsonBody(req), name = text(data.name,80), members = ids(data.members);
          const id = match?.[2] ?? randomUUID();
          if (match) known(db,'access_groups',id);
          members.forEach(c=>known(db,'characters',c));
          transaction(db,()=>{
            db.prepare('INSERT INTO access_groups(id,name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name').run(id,name);
            db.prepare('DELETE FROM group_members WHERE group_id=?').run(id);
            for (const c of members) db.prepare('INSERT INTO group_members(group_id,character_id) VALUES(?,?)').run(id,c);
            audit(db,actor.userId,'GROUP_UPDATED','GROUP',id,{members});
          });
          return send(res,200,{id});
        }
        if (match?.[1] === 'regions' && method === 'PATCH') {
          const id = match[2]!, data = await jsonBody(req); known(db,'regions',id);
          const isOpen=boolean(data.isOpen), scope=audience(data.audience);
          transaction(db,()=>{
            setGrants(db,'REGION',id,data);
            db.prepare('UPDATE regions SET is_open=?,audience=? WHERE id=?').run(isOpen,scope,id);
            audit(db,actor.userId,'REGION_ACCESS_UPDATED','REGION',id,{isOpen:!!isOpen,audience:scope,characters:data.characters,groups:data.groups});
          });
          return send(res,200,{ok:true});
        }
        if (path === '/api/master/locations' && method === 'POST') {
          const data = await jsonBody(req), id = randomUUID(), title=text(data.title,100), region=text(data.regionId,100);
          known(db,'regions',region);
          const image=text(data.image,100); if(!imageFiles.has(image)) fail(400,'Selecione uma imagem disponível.');
          transaction(db,()=>{
            db.prepare("INSERT INTO locations(id,region_id,title,image,kind,is_secret,audience) VALUES(?,?,?,?,'SHOP',1,'SELECTED')").run(id,region,title,image);
            audit(db,actor.userId,'SECRET_LOCATION_CREATED','LOCATION',id);
          });
          return send(res,201,{id});
        }
        if (match?.[1] === 'locations' && method === 'PATCH') {
          const id=match[2]!, data=await jsonBody(req); known(db,'locations',id);
          const enabled=boolean(data.enabled), secret=boolean(data.isSecret), scope=audience(data.audience);
          const coordinate=(v:unknown)=>v===null?null:typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100?v:fail(400,'Posição inválida.');
          const x=coordinate(data.x),y=coordinate(data.y);
          transaction(db,()=>{
            setGrants(db,'LOCATION',id,data);
            db.prepare('UPDATE locations SET enabled=?,is_secret=?,audience=?,x=?,y=? WHERE id=?').run(enabled,secret,scope,x,y,id);
            audit(db,actor.userId,'LOCATION_ACCESS_UPDATED','LOCATION',id,{enabled:!!enabled,isSecret:!!secret,audience:scope,characters:data.characters,groups:data.groups});
          });
          return send(res,200,{ok:true});
        }
        if (match?.[1] === 'characters' && method === 'PATCH') {
          const id=match[2]!, data=await jsonBody(req); known(db,'characters',id);
          const name=text(data.name,100), house=text(data.house,30);
          if (!one(db,'SELECT id FROM houses WHERE id=?',house)) fail(400,'Casa inválida.');
          const year=data.year===null?null:Number.isInteger(data.year)&&Number(data.year)>=1&&Number(data.year)<=7?Number(data.year):fail(400,'Ano escolar inválido.');
          transaction(db,()=>{
            db.prepare('UPDATE characters SET name=?,house_id=?,school_year=?,updated_at=? WHERE id=?').run(name,house,year,now(),id);
            audit(db,actor.userId,'CHARACTER_UPDATED','CHARACTER',id,{house,year});
          });
          return send(res,200,{ok:true});
        }
        fail(404,'Recurso não encontrado.');
      }
      if (path === '/api/state' && method === 'GET') return send(res,200,portalState(db,viewerFor(db,requireSession(session),url)));
      if (path === '/api/profile' && method === 'PATCH') {
        const actor=requireSession(session), id=profileTarget(db,actor,url), data=await jsonBody(req);
        if (Object.keys(data).some(k=>k!=='biography')) fail(403,'Apenas o Mestre altera nome, Casa e ano.');
        const bio=text(data.biography,3000,false);
        transaction(db,()=>{db.prepare('UPDATE characters SET biography=?,updated_at=? WHERE id=?').run(bio,now(),id);audit(db,actor.userId,'PROFILE_UPDATED','CHARACTER',id);});
        return send(res,200,{ok:true});
      }
      if (path === '/api/profile/photo' && (method === 'PUT' || method === 'DELETE')) {
        const actor=requireSession(session), character=profileTarget(db,actor,url);
        rateLimit(db,`photo:${actor.userId}`,30);
        if (method === 'DELETE') {
          const previous=one(db,'SELECT photo_id FROM characters WHERE id=?',character)?.photo_id;
          transaction(db,()=>{
            db.prepare('UPDATE characters SET photo_id=NULL,updated_at=? WHERE id=?').run(now(),character);
            if(previous){
              db.prepare("DELETE FROM access_grants WHERE resource_type='MEDIA' AND resource_id=?").run(previous);
              // Revoke bytes as well; any future publication referencing the portrait loses its attachment.
              db.prepare('UPDATE publications SET media_id=NULL WHERE media_id=?').run(previous);
              db.prepare('DELETE FROM media WHERE id=?').run(previous);
            }
            audit(db,actor.userId,'PHOTO_REMOVED','CHARACTER',character);
          });
          if(previous) await unlink(join(config.dataDir,'media',`${previous}.webp`)).catch(()=>{});
          return send(res,200,{ok:true});
        }
        if (!['image/jpeg','image/png','image/webp'].includes(req.headers['content-type'] ?? '')) fail(415,'Use JPG, PNG ou WebP.');
        const buffer=await bodyBuffer(req,2*1024*1024);
        const detected=buffer.subarray(0,3).equals(Buffer.from([255,216,255]))?'image/jpeg':
          buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':
          buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP'?'image/webp':null;
        if(!detected || detected!==req.headers['content-type']) fail(415,'O conteúdo precisa corresponder a uma imagem JPG, PNG ou WebP.');
        let image:Buffer;
        try {
          const decoder=sharp(buffer,{limitInputPixels:16_000_000,animated:false,failOn:'warning'});
          const meta=await decoder.metadata();
          if(!['jpeg','png','webp'].includes(meta.format ?? '') || (meta.pages ?? 1)>1) fail(415,'Use uma fotografia JPG, PNG ou WebP estática.');
          image=await decoder.rotate().resize(512,512,{fit:'cover',withoutEnlargement:true}).webp({quality:85}).toBuffer();
        } catch(error) { if(error instanceof HttpError) throw error; fail(400,'Não foi possível ler essa imagem.'); }
        const id=randomUUID(), key=`${id}.webp`, file=join(config.dataDir,'media',key);
        await writeFile(file,image,{mode:0o600,flag:'wx'});
        try {
          transaction(db,()=>{
            db.prepare('INSERT INTO media(id,owner_character_id,storage_key,mime,bytes) VALUES(?,?,?,?,?)').run(id,character,key,'image/webp',image.length);
            db.prepare('UPDATE characters SET photo_id=?,updated_at=? WHERE id=?').run(id,now(),character);
            audit(db,actor.userId,'PHOTO_UPDATED','CHARACTER',character);
          });
        } catch(error) { await unlink(file).catch(()=>{}); throw error; }
        return send(res,200,{ok:true});
      }
      const media=path.match(/^\/api\/media\/([a-zA-Z0-9-]+)$/);
      if(media && method==='GET'){
        const viewer=viewerFor(db,requireSession(session),url), record=one(db,'SELECT * FROM media WHERE id=?',media[1]!);
        if(!record || !mediaVisible(db,viewer,record)) fail(404,'Arquivo não encontrado.');
        const bytes=await readFile(join(config.dataDir,'media',basename(String(record.storage_key))));
        res.writeHead(200,{'Content-Type':String(record.mime),'Content-Disposition':'inline; filename="retrato.webp"'});res.end(bytes);return;
      }
      const location=path.match(/^\/api\/locations\/([a-zA-Z0-9-]+)$/);
      if(location && method==='GET'){
        const viewer=viewerFor(db,requireSession(session),url), record=one(db,'SELECT * FROM locations WHERE id=?',location[1]!);
        if(!record || !locationVisible(db,viewer,record)) fail(404,'Local não encontrado.');
        return send(res,200,{...locationDTO(record),items:[]});
      }
      const publication=path.match(/^\/api\/publications\/([a-zA-Z0-9-]+)$/);
      if(publication && method==='GET'){
        const viewer=viewerFor(db,requireSession(session),url), record=one(db,'SELECT * FROM publications WHERE id=?',publication[1]!);
        if(!record || !publicationVisible(db,viewer,record)) fail(404,'Publicação não encontrada.');
        return send(res,200,{id:record.id,title:record.title,body:record.body,kind:record.kind,media:record.media_id?`/api/media/${record.media_id}`:null});
      }
      if(path.startsWith('/api/')) fail(404,'Recurso não encontrado.');
      if(!['GET','HEAD'].includes(method)) fail(405,'Método não permitido.');
      // Only an explicit public directory allowlist is served, never runtime data or source files.
      const staticFile=path.match(/^\/assets\/([^/]+\.webp)$/);
      let filename:string, mime:string;
      if(staticFile){filename=join(config.publicDir,'assets',basename(decodeURIComponent(staticFile[1]!)));mime='image/webp';res.setHeader('Cache-Control','public, max-age=3600');}
      else if(['/style.css','/app.js','/workshop.js'].includes(path)){filename=join(config.publicDir,path.slice(1));mime=extname(path)==='.css'?'text/css; charset=utf-8':'text/javascript; charset=utf-8';}
      else if(path==='/'||path==='/ativar'||path==='/entrar'||/^\/portal(?:\/[a-zA-Z0-9-]+)*$/.test(path)){filename=join(config.publicDir,'index.html');mime='text/html; charset=utf-8';}
      else fail(404,'Página não encontrada.');
      const bytes=await readFile(filename).catch(()=>fail(404,'Arquivo não encontrado.'));
      res.writeHead(200,{'Content-Type':mime});res.end(method==='HEAD'?undefined:bytes);
    } catch(error) {
      if(error instanceof HttpError) send(res,error.status,{error:error.message});
      else {
        // Do not log request bodies, cookies, query tokens, emails, or biography content.
        console.error('Falha interna ao atender solicitação:',error instanceof Error ? error.name : 'UnknownError');
        if(!res.headersSent) send(res,500,{error:'Não foi possível concluir. Tente novamente.'}); else res.end();
      }
    }
  });
  server.requestTimeout=15_000;server.headersTimeout=10_000;
  return {server,db,config};
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const app=createApplication();
  app.server.listen(app.config.port,app.config.host,()=>console.log(`Hogwarts 1890: ${app.config.origin}`));
  for(const signal of ['SIGINT','SIGTERM'] as const) process.on(signal,()=>app.server.close(()=>{app.db.close();process.exit(0);}));
}
