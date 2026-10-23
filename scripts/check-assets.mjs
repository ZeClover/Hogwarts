import { readdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(await readFile('docs/V5-MIDIAS-PUBLICAS.json','utf8'));
const approved={...manifest.preservedV4,...manifest.addedV5};
const directory=await readdir('public/assets');
if(JSON.stringify([...directory].sort())!==JSON.stringify(Object.keys(approved).sort()))throw new Error('A pasta pública contém arquivos fora do inventário aprovado.');
for(const [name,hash] of Object.entries(approved)){
  const bytes=await readFile('public/assets/'+name);
  if(createHash('sha256').update(bytes).digest('hex')!==hash)throw new Error('Imagem divergente do inventário aprovado: '+name);
}
const files = (await readdir('public/assets')).filter(f=>f.endsWith('.webp'));
for(const file of files) await sharp(`public/assets/${file}`).metadata();
const css = await readFile('public/style.css','utf8');
for(const match of css.matchAll(/url\(['"]?\/assets\/([^)'"\s]+)/g)) {
  if(!files.includes(match[1])) throw new Error(`Asset ausente: ${match[1]}`);
}
console.log(`${files.length} imagens WebP válidas; referências CSS verificadas.`);
