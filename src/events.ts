import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { all, one, type DB, type Row } from './db.ts';
import { fail, now, requireSession, viewerFor, sessionFrom, type Viewer, type Session } from './auth.ts';
import { send } from './http.ts';
import type { Config } from './config.ts';
export type EventContent={title:string;text:string;href:string;image?:string|null;alt?:string};
type Resolver=(db:DB,viewer:Viewer,event:Row)=>EventContent|null;
const resolvers=new Map<string,Resolver>();
export function registerEvent(type:string,resolver:Resolver){resolvers.set(type,resolver);}
export function enqueue(db:DB,characterId:string,type:string,resourceId:string,fragmentId:string|null,presentation='ANIMATED'){
  const id=randomUUID();db.prepare('INSERT INTO delivery_events(id,character_id,type,resource_id,fragment_id,presentation) VALUES(?,?,?,?,?,?)').run(id,characterId,type,resourceId,fragmentId,presentation);return id;
}
function visible(db:DB,viewer:Viewer,event:Row){
  if(event.character_id!==viewer.characterId)return null;const content=resolvers.get(String(event.type))?.(db,viewer,event);
  return content?{id:event.id,presentation:event.presentation,acknowledged:!!event.acknowledged_at,...content}:null;
}
function listing(db:DB,viewer:Viewer,history=false){return all(db,`SELECT * FROM delivery_events WHERE character_id=? ${history?'':'AND acknowledged_at IS NULL'} ORDER BY created_at ${history?'DESC':'ASC'},id`,viewer.characterId)
  .flatMap(row=>{const dto=visible(db,viewer,row);return dto?[dto]:[];}).slice(0,history?30:100);}
export async function handleEvents(req:IncomingMessage,res:ServerResponse,url:URL,db:DB,config:Config,session?:Session):Promise<boolean>{
  if(!url.pathname.startsWith('/api/events'))return false;
  const actor=requireSession(session),viewer=viewerFor(db,actor,url),path=url.pathname,method=req.method??'GET';
  if(!viewer.characterId)fail(403,'Selecione seu personagem para consultar revelações.');
  if(path==='/api/events/stream'&&method==='GET'){
    if(actor.role!=='PLAYER'||viewer.preview)fail(403,'A prévia não abre apresentações.');
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();let previous='';
    const tick=()=>{try{const current=sessionFrom(db,req,config);if(!current||current.role!=='PLAYER'||current.characterId!==viewer.characterId){res.end();return;}
      const ids=JSON.stringify(listing(db,viewer).map(e=>e.id));if(ids!==previous){previous=ids;res.write(`data: ${ids}\n\n`);}else res.write(': heartbeat\n\n');}catch{res.end();}};
    tick();const timer=setInterval(tick,1000);timer.unref();res.on('close',()=>clearInterval(timer));return true;
  }
  if((path==='/api/events'||path==='/api/events/history')&&method==='GET'){send(res,200,{items:listing(db,viewer,path.endsWith('/history'))});return true;}
  const match=path.match(/^\/api\/events\/([\w-]+)(?:\/(ack))?$/);
  if(match){const event=one(db,'SELECT * FROM delivery_events WHERE id=? AND character_id=?',match[1]!,viewer.characterId)??fail(404,'Revelação não encontrada.');
    if(!match[2]&&method==='GET'){const dto=visible(db,viewer,event)??fail(404,'Revelação não encontrada.');send(res,200,dto);return true;}
    if(match[2]&&method==='POST'){if(viewer.preview)fail(403,'A prévia é somente leitura.');db.prepare('UPDATE delivery_events SET acknowledged_at=COALESCE(acknowledged_at,?) WHERE id=?').run(now(),String(event.id));send(res,200,{ok:true});return true;}
  }
  fail(404,'Recurso não encontrado.');
}
