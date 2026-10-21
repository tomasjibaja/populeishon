import { describe, expect, it } from 'vitest';
import { exampleScore } from '@partituras/core';
import { ApiError, createHttpScoreStore, messageOf } from './scoresApi';

interface Call {
  url: string;
  init?: RequestInit;
}

function fake(respond: (call: Call) => Response | Promise<Response> | Error) {
  const calls: Call[] = [];
  const fetchFn: typeof fetch = async (input, init) => {
    const call: Call = { url: String(input), ...(init ? { init } : {}) };
    calls.push(call);
    const result = await respond(call);
    if (result instanceof Error) throw result;
    return result;
  };
  return { store: createHttpScoreStore({ fetchFn }), calls };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
  }
  throw new Error('Se esperaba un ApiError');
}

describe('cliente de la API', () => {
  it('lista con los parámetros en la dirección y omite los vacíos', async () => {
    const { store, calls } = fake(() => json(200, { items: [], total: 0, limit: 50, skip: 0 }));
    await store.list();
    await store.list({ q: 'juárez', keyFifths: 1, keyMode: 'minor', limit: 10, style: '' });
    expect(calls[0]?.url).toBe('/api/scores');
    expect(calls[1]?.url).toBe('/api/scores?q=ju%C3%A1rez&keyFifths=1&keyMode=minor&limit=10');
  });

  it('pide las facetas para los filtros', async () => {
    const { store, calls } = fake(() => json(200, { styles: [{ name: 'Zamba', styleKey: 'zamba', count: 2 }], keys: [] }));
    const facets = await store.facets();
    expect(calls[0]?.url).toBe('/api/facets');
    expect(facets.styles[0]?.name).toBe('Zamba');
  });

  it('lee una partitura y codifica el id en la dirección', async () => {
    const { store, calls } = fake(() => json(200, { id: 'x', score: exampleScore }));
    const doc = await store.get('a/b c');
    expect(calls[0]?.url).toBe('/api/scores/a%2Fb%20c');
    expect(doc.id).toBe('x');
  });

  it('guarda enviando JSON y devuelve la respuesta', async () => {
    const { store, calls } = fake(() => json(201, { document: { id: 'nuevo' }, warnings: [] }));
    const result = await store.create({ score: exampleScore, source: { kind: 'musicxml', fileName: 'a.musicxml', musicXml: '<x/>' } });
    expect(result.document.id).toBe('nuevo');
    const call = calls[0]!;
    expect(call.url).toBe('/api/scores');
    expect(call.init?.method).toBe('POST');
    expect((call.init?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    const sent = JSON.parse(String(call.init?.body)) as { score: { title: string }; source: { musicXml: string } };
    expect(sent.score.title).toBe('Melodía de ejemplo');
    expect(sent.source.musicXml).toBe('<x/>');
  });

  it('reemplaza con PUT y elimina con DELETE (204 sin cuerpo)', async () => {
    const { store, calls } = fake((call) => (call.init?.method === 'DELETE' ? new Response(null, { status: 204 }) : json(200, { document: {}, warnings: [] })));
    await store.replace('abc', { score: exampleScore });
    await store.remove('abc');
    expect(calls.map((c) => `${c.init?.method} ${c.url}`)).toEqual(['PUT /api/scores/abc', 'DELETE /api/scores/abc']);
  });
});

describe('errores del cliente', () => {
  it('convierte el error de la API con su código y detalles', async () => {
    const { store } = fake(() =>
      json(422, { error: { code: 'validation_error', message: 'La partitura no es válida.', details: ['score.title: no puede estar vacío', 'score.measures: debe tener al menos un compás'] } }),
    );
    const error = await failure(store.create({ score: exampleScore }));
    expect(error.status).toBe(422);
    expect(error.code).toBe('validation_error');
    expect(error.details).toHaveLength(2);
    expect(messageOf(error)).toBe('La partitura no es válida. score.title: no puede estar vacío · score.measures: debe tener al menos un compás');
  });

  it('un 404 de la API trae su mensaje', async () => {
    const { store } = fake(() => json(404, { error: { code: 'not_found', message: 'No se encontró la partitura.' } }));
    const error = await failure(store.get('0123456789abcdef01234567'));
    expect(error.status).toBe(404);
    expect(error.message).toBe('No se encontró la partitura.');
  });

  it('si no hay conexión explica cómo levantar la API', async () => {
    const { store } = fake(() => new Error('fetch failed'));
    const error = await failure(store.list());
    expect(error.status).toBe(0);
    expect(error.code).toBe('network_error');
    expect(error.message.includes('npm run dev:api')).toBe(true);
  });

  it('un error del proxy sin JSON (la API no responde) da el mismo consejo', async () => {
    const { store } = fake(() => new Response('Error: connect ECONNREFUSED', { status: 500 }));
    const error = await failure(store.list());
    expect(error.message.includes('npm run dev:api')).toBe(true);
    const gateway = await failure(fake(() => new Response('', { status: 502 })).store.list());
    expect(gateway.message.includes('npm run dev:api')).toBe(true);
  });

  it('un error interno de la API no revela detalles y un 4xx sin JSON da un mensaje genérico', async () => {
    const internal = await failure(fake(() => json(500, { error: { code: 'internal_error', message: 'Error interno del servidor.' } })).store.list());
    expect(internal.message).toBe('Error interno del servidor.');
    const other = await failure(fake(() => new Response('no', { status: 403 })).store.list());
    expect(other.message).toBe('Error 403 del servidor.');
  });

  it('messageOf acepta cualquier error', () => {
    expect(messageOf(new Error('algo'))).toBe('algo');
    expect(messageOf('texto')).toBe('texto');
    expect(messageOf(new ApiError('sin detalles', 400))).toBe('sin detalles');
  });
});
