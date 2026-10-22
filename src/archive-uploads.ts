import { randomUUID } from 'node:crypto';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Config } from './config.ts';
import { all, one, type DB } from './db.ts';
import { fail, type Session } from './auth.ts';
import { fields, jsonBody, record, send, text } from './http.ts';
import { privateStorage } from './storage.ts';

const maxBytes=128*1024*1024;
export async function handleArchiveUploads(req: IncomingMessage,res: ServerResponse,url: URL,db: DB,config: Config,actor: Session): Promise<boolean> {
  const path=url.pathname;
  if(!['/api/master/archives/uploads','/api/master/archives/upload-token'].includes(path))return false;
  if(req.method!=='POST'||config.storageMode!=='blob')fail(404,'Operação de arquivo não encontrada.');
  if(path.endsWith('/uploads')){
    const body=await jsonBody(req,4096);fields(body,['bytes']);
    if(!Number.isSafeInteger(body.bytes)||Number(body.bytes)<=0||Number(body.bytes)>maxBytes)fail(400,'Use um arquivo de até 128 MB.');
    const expired=await all(db,'SELECT storage_key FROM archive_uploads WHERE expires_at<?',Date.now());
    await db.prepare('DELETE FROM archive_uploads WHERE expires_at<?').run(Date.now());
    for(const row of expired)await privateStorage(config).remove(String(row.storage_key),'staging').catch(()=>{});
    const id=randomUUID(),key=id+'.upload';
    await db.prepare('INSERT INTO archive_uploads(id,actor_id,storage_key,bytes,expires_at) VALUES(?,?,?,?,?)').run(id,actor.userId,key,Number(body.bytes),Date.now()+10*60*1000);
    send(res,201,{id,pathname:`${config.storagePrefix}/staging/${key}`});return true;
  }
  const body=await jsonBody(req,8192);
  if(body.type!=='blob.generate-client-token')fail(400,'Solicitação de envio inválida.');
  const payload=record(body.payload);
  text(payload.pathname,200);
  const result=await handleUpload({body:body as unknown as HandleUploadBody,request:req,onBeforeGenerateToken:async pathname=>{
    const prefix=`${config.storagePrefix}/staging/`,key=pathname.startsWith(prefix)?pathname.slice(prefix.length):'';
    if(!/^[0-9a-f-]{36}\.upload$/.test(key))fail(400,'Destino de envio inválido.');
    const row=await one(db,'SELECT * FROM archive_uploads WHERE storage_key=? AND actor_id=? AND expires_at>?',key,actor.userId,Date.now());
    if(!row)fail(404,'Envio não encontrado ou expirado.');
    return {allowedContentTypes:['application/octet-stream'],maximumSizeInBytes:Number(row.bytes),validUntil:Number(row.expires_at),addRandomSuffix:false,allowOverwrite:false};
  }});
  send(res,200,result);return true;
}

// Only an upload issued to this Master can be consumed. No supplied URL is fetched.
export async function archiveInput(db: DB,config: Config,actor: Session,body: Record<string,unknown>,limit: number): Promise<Record<string,unknown>> {
  if(!('uploadId' in body))return body;
  fields(body,['uploadId','strategy']);
  const id=text(body.uploadId,100),row=await one(db,'SELECT * FROM archive_uploads WHERE id=? AND actor_id=? AND expires_at>?',id,actor.userId,Date.now());
  if(!row)fail(404,'Envio não encontrado ou expirado.');
  const key=String(row.storage_key);
  try {
    const bytes=await privateStorage(config).read(key,'staging');
    if(bytes.length!==Number(row.bytes)||bytes.length>limit)fail(413,'O arquivo ultrapassa o tamanho permitido para esta operação.');
    let value: unknown;
    try{value=JSON.parse(bytes.toString('utf8'));}catch{fail(400,'O arquivo não contém JSON válido.');}
    const content=record(value);
    return body.strategy!==undefined?{package:content,strategy:body.strategy}:content;
  }finally{
    await db.prepare('DELETE FROM archive_uploads WHERE id=?').run(id);
    await privateStorage(config).remove(key,'staging').catch(()=>{});
  }
}
