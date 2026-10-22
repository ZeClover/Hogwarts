import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { get, put, del } from '@vercel/blob';
import type { Config } from './config.ts';

type Area = 'media' | 'recoveries' | 'plans' | 'staging';
function missing(): Error & {code: string} { return Object.assign(new Error('Arquivo não encontrado.'),{code:'ENOENT'}); }
function check(name: string, area: Area) {
  const extension=area==='media'?'webp':area==='plans'?'plan':area==='staging'?'upload':'hogwarts';
  if(!new RegExp('^[0-9a-f-]{36}\\.'+extension+'$').test(name)) throw new Error('Identificador de arquivo inválido.');
}
export function privateStorage(config: Config) {
  const remote=config.storageMode==='blob';
  const prefix=config.storagePrefix??'hogwarts';
  const path=(name: string,area: Area)=>`${prefix}/${area}/${name}`;
  return {
    async read(name: string,area: Area='media'): Promise<Buffer> {
      check(name,area);
      if(!remote)return readFile(join(config.dataDir,area,name));
      const result=await get(path(name,area),{access:'private',useCache:false,token:process.env.BLOB_READ_WRITE_TOKEN});
      if(!result||result.statusCode!==200)throw missing();
      return Buffer.from(await new Response(result.stream).arrayBuffer());
    },
    async write(name: string,bytes: Buffer,area: Area='media'): Promise<void> {
      check(name,area);
      if(!remote){await mkdir(join(config.dataDir,area),{recursive:true,mode:0o700});await writeFile(join(config.dataDir,area,name),bytes,{mode:0o600,flag:'wx'});return;}
      await put(path(name,area),bytes,{access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:area==='media'?'image/webp':'application/octet-stream',token:process.env.BLOB_READ_WRITE_TOKEN});
    },
    async remove(name: string,area: Area='media'): Promise<void> {
      check(name,area);
      if(!remote){await unlink(join(config.dataDir,area,name));return;}
      await del(path(name,area),{token:process.env.BLOB_READ_WRITE_TOKEN});
    }
  };
}
