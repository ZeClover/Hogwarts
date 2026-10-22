import { build } from 'esbuild';

await build({entryPoints:['scripts/blob-client-entry.mjs'],outfile:'public/blob-client.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
