import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHostedApplication } from './hosted.ts';
import { StartupProblem } from './startup-problem.ts';

// Vercel invokes an exported function; an unstarted http.Server is not a handler.
export function createHostedHandler(initialize = createHostedApplication) {
  let application: ReturnType<typeof createHostedApplication> | undefined;
  return async (req: IncomingMessage, res: ServerResponse) => {
    const pending = application ??= Promise.resolve().then(initialize);
    let app;
    try {
      app = await pending;
    } catch (error) {
      // A failed cold start must not poison this worker's subsequent requests.
      if (application === pending) application = undefined;
      // SDK messages can contain connection URLs or tokens. Log only a controlled startup code or the error class.
      console.error('HOGWARTS_STARTUP_FAILED:', error instanceof StartupProblem ? error.code : error instanceof Error ? error.name : 'UnknownError');
      res.writeHead(503, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Retry-After': '5',
      });
      res.end(JSON.stringify(error instanceof StartupProblem?{error:error.message,code:error.code,...(error.missing.length?{missing:error.missing}:{})}:{ error: 'O serviço de acesso não conseguiu iniciar. Tente novamente em instantes.' }));
      return;
    }
    // Await the existing listener so Vercel retains the request until it finishes.
    const listener = app.server.listeners('request')[0];
    if (!listener) throw new Error('O servidor não possui um handler de requisições.');
    await listener.call(app.server, req, res);
  };
}
