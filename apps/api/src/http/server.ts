import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { DomainError, badRequest } from '../domain/errors';
import { ScoreService } from '../domain/scoreService';
import type { ListQuery, RequestContext } from '../domain/types';

export interface AppDeps {
  readonly service: ScoreService;
  readonly storage: 'memory' | 'mongo';
  /** Tamaño máximo del cuerpo de una petición, en bytes. */
  readonly maxBodyBytes?: number;
  /** Para registrar errores inesperados. */
  readonly log?: (message: string, error?: unknown) => void;
}

const DEFAULT_MAX_BODY = 30 * 1024 * 1024;

const STATUS: Record<DomainError['code'], number> = {
  bad_request: 400,
  validation_error: 422,
  not_found: 404,
  payload_too_large: 413,
  unsupported_media_type: 415,
};

const BASE_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } as const;

function sendJson(res: ServerResponse, status: number, body: unknown, extraHeaders: Record<string, string> = {}): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    ...BASE_HEADERS,
    ...extraHeaders,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
  });
  res.end(text);
}

function sendEmpty(res: ServerResponse, status: number): void {
  res.writeHead(status, BASE_HEADERS);
  res.end();
}

function sendError(res: ServerResponse, status: number, code: string, message: string, details?: readonly string[], headers: Record<string, string> = {}): void {
  sendJson(res, status, { error: { code, message, ...(details ? { details } : {}) } }, headers);
}

async function readJson(req: IncomingMessage, limit: number): Promise<unknown> {
  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new DomainError('unsupported_media_type', 'El cuerpo debe enviarse como application/json.');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > limit) throw new DomainError('payload_too_large', `El cuerpo supera el máximo permitido (${Math.round(limit / 1024 / 1024)} MB).`);
    chunks.push(buffer);
  }
  if (size === 0) throw badRequest('Falta el cuerpo de la petición.');
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw badRequest('El cuerpo no es un JSON válido.');
  }
}

function parseListQuery(params: URLSearchParams): ListQuery {
  const integer = (name: string, min: number, max: number): number | undefined => {
    const raw = params.get(name);
    if (raw === null || raw === '') return undefined;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) throw badRequest(`"${name}" debe ser un entero entre ${min} y ${max}.`);
    return value;
  };
  const keyMode = params.get('keyMode');
  if (keyMode !== null && keyMode !== '' && keyMode !== 'major' && keyMode !== 'minor') {
    throw badRequest('"keyMode" debe ser "major" o "minor".');
  }
  const q = params.get('q');
  const style = params.get('style');
  const keyFifths = integer('keyFifths', -7, 7);
  const limit = integer('limit', 1, 100);
  const skip = integer('skip', 0, 1_000_000);
  return {
    ...(q ? { q } : {}),
    ...(style ? { style } : {}),
    ...(keyFifths !== undefined ? { keyFifths } : {}),
    ...(keyMode === 'major' || keyMode === 'minor' ? { keyMode } : {}),
    ...(limit !== undefined ? { limit } : {}),
    ...(skip !== undefined ? { skip } : {}),
  };
}

type Handler = (args: { req: IncomingMessage; res: ServerResponse; params: string[]; query: URLSearchParams }) => Promise<void>;

interface Route {
  readonly method: string;
  readonly pattern: RegExp;
  readonly handler: Handler;
}

/** Servidor HTTP de la API (sin dependencias: solo `node:http`). */
export function createApp(deps: AppDeps): Server {
  const { service } = deps;
  const limit = deps.maxBodyBytes ?? DEFAULT_MAX_BODY;
  // Todavía no hay usuarios: toda petición es del "dueño" null. Cuando haya autenticación, saldrá de ahí.
  const context: RequestContext = { ownerId: null };

  const id = '([^/]+)';
  const routes: Route[] = [
    {
      method: 'GET',
      pattern: /^\/api\/health$/,
      handler: async ({ res }) => sendJson(res, 200, { status: 'ok', storage: deps.storage }),
    },
    {
      method: 'GET',
      pattern: /^\/api\/scores$/,
      handler: async ({ res, query }) => sendJson(res, 200, await service.list(parseListQuery(query), context)),
    },
    {
      method: 'GET',
      pattern: /^\/api\/facets$/,
      handler: async ({ res }) => sendJson(res, 200, await service.facets(context)),
    },
    {
      method: 'POST',
      pattern: /^\/api\/scores$/,
      handler: async ({ req, res }) => {
        const result = await service.create(await readJson(req, limit), context);
        sendJson(res, 201, result, { Location: `/api/scores/${result.document.id}` });
      },
    },
    {
      method: 'GET',
      pattern: new RegExp(`^/api/scores/${id}/musicxml$`),
      handler: async ({ res, params }) => {
        const xml = await service.getMusicXml(params[0] ?? '', context);
        res.writeHead(200, { ...BASE_HEADERS, 'Content-Type': 'application/xml; charset=utf-8', 'Content-Length': Buffer.byteLength(xml) });
        res.end(xml);
      },
    },
    {
      method: 'GET',
      pattern: new RegExp(`^/api/scores/${id}$`),
      handler: async ({ res, params }) => sendJson(res, 200, await service.get(params[0] ?? '', context)),
    },
    {
      method: 'PUT',
      pattern: new RegExp(`^/api/scores/${id}$`),
      handler: async ({ req, res, params }) =>
        sendJson(res, 200, await service.replace(params[0] ?? '', await readJson(req, limit), context)),
    },
    {
      method: 'DELETE',
      pattern: new RegExp(`^/api/scores/${id}$`),
      handler: async ({ res, params }) => {
        await service.remove(params[0] ?? '', context);
        sendEmpty(res, 204);
      },
    },
  ];

  return createServer((req, res) => {
    void (async () => {
      try {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const method = (req.method ?? 'GET').toUpperCase();
        let path: string;
        try {
          path = decodeURIComponent(url.pathname);
        } catch {
          throw badRequest('La dirección tiene caracteres mal codificados.');
        }
        const matching = routes
          .map((route) => ({ route, match: route.pattern.exec(path) }))
          .filter((entry) => entry.match !== null);

        if (matching.length === 0) {
          sendError(res, 404, 'not_found', 'La ruta no existe.');
          return;
        }
        const hit = matching.find((entry) => entry.route.method === method);
        if (!hit || !hit.match) {
          const allowed = [...new Set(matching.map((entry) => entry.route.method))].join(', ');
          sendError(res, 405, 'method_not_allowed', 'Método no permitido para esta ruta.', undefined, { Allow: allowed });
          return;
        }
        await hit.route.handler({ req, res, params: hit.match.slice(1), query: url.searchParams });
      } catch (error) {
        if (res.headersSent) {
          res.destroy();
          return;
        }
        if (error instanceof DomainError) {
          // Si se rechazó el cuerpo sin leerlo, se cierra la conexión para no dejarla colgada.
          const close: Record<string, string> =
            error.code === 'payload_too_large' || error.code === 'unsupported_media_type' ? { Connection: 'close' } : {};
          sendError(res, STATUS[error.code], error.code, error.message, error.details, close);
          return;
        }
        deps.log?.('Error inesperado', error);
        sendError(res, 500, 'internal_error', 'Error interno del servidor.');
      }
    })();
  });
}
