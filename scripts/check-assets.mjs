import { readdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';
const files = (await readdir('public/assets')).filter(f=>f.endsWith('.webp'));
for(const file of files) await sharp(`public/assets/${file}`).metadata();
const css = await readFile('public/style.css','utf8');
for(const match of css.matchAll(/url\(['"]?\/assets\/([^)'"\s]+)/g)) {
  if(!files.includes(match[1])) throw new Error(`Asset ausente: ${match[1]}`);
}
console.log(`${files.length} imagens WebP válidas; referências CSS verificadas.`);
