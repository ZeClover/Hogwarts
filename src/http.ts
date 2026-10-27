import type { IncomingMessage, ServerResponse } from 'node:http';
import { fail } from './auth.ts';

export async function bodyBuffer(req: IncomingMessage, limit: number): Promise<Buffer> {
  if (Number(req.headers['content-length'] ?? 0) > limit) fail(413,'O arquivo ou formulário excede o limite permitido.');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) fail(413,'O arquivo ou formulário excede o limite permitido.');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
export async function jsonBody(req: IncomingMessage, limit=32_768): Promise<Record<string, unknown>> {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') fail(415,'Envie um formulário JSON.');
  const bytes = await bodyBuffer(req, limit);
  let parsed;
  try { parsed = JSON.parse(bytes.toString('utf8')); } catch { fail(400,'Formulário inválido.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail(400,'Formulário inválido.');
  return parsed;
}
export function send(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});
  res.end(JSON.stringify(value));
}
export function text(value: unknown, max: number, required = true): string {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) fail(400,'Confira os campos informados.');
  return value.trim();
}
export function record(value: unknown): Record<string,unknown> {
  if(!value || typeof value!=='object' || Array.isArray(value)) fail(400,'Formulário inválido.');
  return value as Record<string,unknown>;
}
export function fields(data: Record<string,unknown>, allowed: string[]) {
  if(Object.keys(data).some(k=>!allowed.includes(k))) fail(400,'Campo não permitido.');
}
export function stringIds(value: unknown): string[] {
  if(!Array.isArray(value)||value.length>100||value.some(x=>typeof x!=='string'||x.length>100)) fail(400,'Seleção inválida.');
  return [...new Set(value as string[])];
}
