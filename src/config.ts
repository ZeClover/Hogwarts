import { resolve } from 'node:path';

export function configuration() {
  const remote=process.env.PERSISTENCE_BACKEND==='turso'||process.env.VERCEL==='1';
  if(process.env.VERCEL==='1'&&process.env.PERSISTENCE_BACKEND==='local')throw new Error('A Vercel exige persistência remota.');
  const port = Number(process.env.PORT ?? 3000);
  const origin = new URL(process.env.APP_ORIGIN ?? `http://127.0.0.1:${port}`);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) {
    throw new Error('APP_ORIGIN precisa conter apenas a origem HTTP(S).');
  }
  if (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:') throw new Error('Produção exige HTTPS.');
  return {
    port, host: process.env.HOST ?? '127.0.0.1', origin: origin.origin,
    secure: origin.protocol === 'https:', dataDir: resolve(process.env.DATA_DIR ?? 'data'),
    publicDir: resolve('public'), migrationsDir: resolve('migrations'),
    databaseMode: (remote?'turso':'local') as 'turso'|'local',
    storageMode: (remote?'blob':'local') as 'blob'|'local',
    storagePrefix: process.env.HOGWARTS_STORAGE_PREFIX??'hogwarts'
  };
}
export type Config = ReturnType<typeof configuration>;
