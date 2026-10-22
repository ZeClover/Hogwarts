import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DB } from './db.ts';
import { one } from './db.ts';
import type { Config } from './config.ts';
export const now = () => Math.floor(Date.now() / 1000);
export const token = () => randomBytes(32).toString('hex');
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export class HttpError extends Error {
    status: number;
    constructor(status: number, message: string) { super(message); this.status = status; }
}
export function fail(status: number, message: string): never { throw new HttpError(status, message); }
function derive(password: string, salt: string): Promise<Buffer> {
    return new Promise((resolve, reject) => scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
}
export async function hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    return `${salt}:${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, stored?: string) {
    const [salt, hex] = (stored ?? `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
    const actual = await derive(password, salt!);
    const expected = Buffer.from(hex!, 'hex');
    return expected.length === actual.length && timingSafeEqual(actual, expected) && !!stored;
}
export function validPassword(value: unknown): string {
    if (typeof value !== 'string' || value.length < 12 || value.length > 128)
        fail(400, 'Use uma senha entre 12 e 128 caracteres.');
    return value;
}
export function email(value: unknown): string {
    if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
        fail(400, 'Informe um e-mail válido.');
    return value.trim().toLowerCase();
}
export type Session = {
    userId: string;
    role: 'MASTER' | 'PLAYER';
    characterId: string | null;
    csrf: string;
    hash: string;
};
export type Viewer = {
    userId: string;
    role: 'MASTER' | 'PLAYER';
    characterId: string | null;
    preview: boolean;
};
const cookieName = (config: Config) => config.secure ? '__Host-hogwarts' : 'hogwarts';
export async function sessionFrom(db: DB, req: IncomingMessage, config: Config): Promise<Session | undefined> {
    const name = cookieName(config);
    const raw = req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith(`${name}=`))?.slice(name.length + 1);
    if (!raw || !/^[a-f0-9]{64}$/.test(raw))
        return;
    const row = await one(db, `SELECT s.token_hash,s.csrf,u.id,u.role,u.character_id FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>? AND u.disabled=0`, digest(raw), now());
    if (!row)
        return;
    return { userId: String(row.id), role: row.role as Session['role'], characterId: row.character_id as string | null, csrf: String(row.csrf), hash: String(row.token_hash) };
}
export async function createSession(db: DB, res: ServerResponse, config: Config, userId: string) {
    const raw = token();
    await db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now());
    await db.prepare('INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES(?,?,?,?)').run(digest(raw), userId, token(), now() + 43200);
    res.setHeader('Set-Cookie', `${cookieName(config)}=${raw}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${config.secure ? '; Secure' : ''}`);
}
export function clearSession(res: ServerResponse, config: Config) {
    res.setHeader('Set-Cookie', `${cookieName(config)}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${config.secure ? '; Secure' : ''}`);
}
export function requireSession(session?: Session): Session {
    return session ?? fail(401, 'Entre para acessar os arquivos.');
}
export function requireMaster(session?: Session): Session {
    const actor = requireSession(session);
    if (actor.role !== 'MASTER')
        fail(403, 'Acesso reservado ao Mestre.');
    return actor;
}
export async function viewerFor(db: DB, session: Session, url: URL): Promise<Viewer> {
    const preview = url.searchParams.get('view_as');
    if (preview !== null) {
        requireMaster(session);
        if (!await one(db, 'SELECT id FROM characters WHERE id=?', preview))
            fail(404, 'Personagem não encontrado.');
        return { userId: session.userId, role: 'PLAYER', characterId: preview, preview: true };
    }
    return { userId: session.userId, role: session.role, characterId: session.characterId, preview: false };
}
export function mutationGuard(req: IncomingMessage, config: Config, session: Session | undefined, url: URL) {
    if (req.headers.origin !== config.origin)
        fail(403, 'Origem da solicitação inválida.');
    if (url.searchParams.has('view_as'))
        fail(403, 'A visualização de personagem é somente leitura.');
    if (session && req.headers['x-csrf-token'] !== session.csrf)
        fail(403, 'Atualize a página e tente novamente.');
}
export async function rateLimit(db: DB, key: string, max = 20) {
    await db.prepare('DELETE FROM auth_limits WHERE reset_at<=?').run(now());
    await db.prepare(`INSERT INTO auth_limits(key,attempts,reset_at) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET attempts=attempts+1`).run(digest(key), now() + 900);
    if (Number((await one(db, 'SELECT attempts FROM auth_limits WHERE key=?', digest(key)))?.attempts) > max)
        fail(429, 'Muitas tentativas. Tente novamente em 15 minutos.');
}
