import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exampleScore, longExampleScore } from '@partituras/core';
import { ScoreService } from '../domain/scoreService';
import { MemoryScoreRepository } from '../storage/memoryRepository';
import { createApp } from './server';

const json = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

let server: Server;
let tinyServer: Server;
let base = '';
let tinyBase = '';

const listen = (app: Server): Promise<string> =>
  new Promise((resolve) => app.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(app.address() as AddressInfo).port}`)));
const close = (app: Server): Promise<void> => new Promise((resolve) => app.close(() => resolve()));

beforeAll(async () => {
  server = createApp({ service: new ScoreService(new MemoryScoreRepository()), storage: 'memory' });
  tinyServer = createApp({ service: new ScoreService(new MemoryScoreRepository()), storage: 'memory', maxBodyBytes: 1000 });
  base = await listen(server);
  tinyBase = await listen(tinyServer);
});

afterAll(async () => {
  await close(server);
  await close(tinyServer);
});

async function call(path: string, init: { method?: string; body?: unknown; raw?: string; contentType?: string | null; url?: string } = {}) {
  const headers: Record<string, string> = {};
  const contentType = init.contentType === undefined ? 'application/json' : init.contentType;
  if (contentType) headers['Content-Type'] = contentType;
  const body = init.raw !== undefined ? init.raw : init.body !== undefined ? JSON.stringify(init.body) : undefined;
  const response = await fetch(`${init.url ?? base}${path}`, { method: init.method ?? 'GET', headers, ...(body !== undefined ? { body } : {}) });
  const text = await response.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  return { status: response.status, headers: response.headers, data };
}

describe('API: salud y rutas', () => {
  it('responde la salud con el tipo de almacenamiento', async () => {
    const r = await call('/api/health');
    expect(r.status).toBe(200);
    expect(r.data).toEqual({ status: 'ok', storage: 'memory' });
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('content-type')?.startsWith('application/json')).toBe(true);
  });

  it('una ruta que no existe da 404 y un método incorrecto da 405 con "Allow"', async () => {
    expect((await call('/api/nada')).status).toBe(404);
    expect((await call('/otra-cosa')).status).toBe(404);
    const r = await call('/api/scores', { method: 'DELETE' });
    expect(r.status).toBe(405);
    expect(r.headers.get('allow')).toBe('GET, POST');
    expect(r.data.error.code).toBe('method_not_allowed');
  });
});

describe('API: ciclo completo de una partitura', () => {
  it('crear, leer, listar, reemplazar y borrar', async () => {
    const created = await call('/api/scores', { method: 'POST', body: { score: json(exampleScore) } });
    expect(created.status).toBe(201);
    const id: string = created.data.document.id;
    expect(/^[0-9a-f]{24}$/.test(id)).toBe(true);
    expect(created.headers.get('location')).toBe(`/api/scores/${id}`);
    expect(created.data.warnings).toEqual([]);

    const read = await call(`/api/scores/${id}`);
    expect(read.status).toBe(200);
    expect(read.data.score).toEqual(exampleScore);
    expect(read.data.title).toBe('Melodía de ejemplo');

    const listed = await call('/api/scores');
    expect(listed.status).toBe(200);
    expect(listed.data.total).toBe(1);
    expect(listed.data.items[0].id).toBe(id);
    expect(listed.data.items[0].score).toBe(undefined);

    const replaced = await call(`/api/scores/${id}`, { method: 'PUT', body: { score: { ...json(longExampleScore), title: 'Otro título' } } });
    expect(replaced.status).toBe(200);
    expect(replaced.data.document.title).toBe('Otro título');
    expect(replaced.data.document.measureCount).toBe(33);

    const deleted = await call(`/api/scores/${id}`, { method: 'DELETE' });
    expect(deleted.status).toBe(204);
    expect(deleted.data).toBe(undefined);
    expect((await call(`/api/scores/${id}`)).status).toBe(404);
    expect((await call(`/api/scores/${id}`, { method: 'DELETE' })).status).toBe(404);
  });

  it('guarda y devuelve la letra con sus saltos de línea', async () => {
    const lyrics = 'Primer verso\nSegundo verso\n\nOtra estrofa';
    const created = await call('/api/scores', { method: 'POST', body: { score: { ...json(exampleScore), lyrics } } });
    expect(created.status).toBe(201);
    const read = await call(`/api/scores/${created.data.document.id}`);
    expect(read.data.score.lyrics).toBe(lyrics);
    expect(read.data.hasLyrics).toBe(true);
    await call(`/api/scores/${created.data.document.id}`, { method: 'DELETE' });
  });

  it('el MusicXML original se guarda aparte y se descarga por su ruta', async () => {
    const xml = '<?xml version="1.0"?><score-partwise><part-list/></score-partwise>';
    const created = await call('/api/scores', {
      method: 'POST',
      body: { score: json(exampleScore), source: { kind: 'musicxml', fileName: 'tema.musicxml', musicXml: xml } },
    });
    const id: string = created.data.document.id;
    expect(created.data.document.source).toEqual({ kind: 'musicxml', fileName: 'tema.musicxml', hasMusicXml: true, importedAt: created.data.document.source.importedAt });
    expect(JSON.stringify(created.data).includes('part-list')).toBe(false);

    const download = await call(`/api/scores/${id}/musicxml`);
    expect(download.status).toBe(200);
    expect(download.headers.get('content-type')?.startsWith('application/xml')).toBe(true);
    expect(download.data).toBe(xml);

    const without = await call('/api/scores', { method: 'POST', body: { score: json(exampleScore) } });
    expect((await call(`/api/scores/${without.data.document.id}/musicxml`)).status).toBe(404);
  });

  it('busca y filtra por la URL', async () => {
    const svc = (title: string, composer: string, style: string, fifths: number, mode: string) =>
      call('/api/scores', { method: 'POST', body: { score: { ...json(exampleScore), title, composer, style, originalKey: { fifths, mode } } } });
    await svc('Tema Alfa', 'Ana Pérez', 'Zamba', 2, 'minor');
    await svc('Tema Beta', 'Luis Gómez', 'Chacarera', 2, 'major');

    expect((await call('/api/scores?q=perez')).data.items.map((i: { title: string }) => i.title)).toEqual(['Tema Alfa']);
    expect((await call('/api/scores?style=chacarera')).data.items.map((i: { title: string }) => i.title)).toEqual(['Tema Beta']);
    expect((await call('/api/scores?keyFifths=2&keyMode=minor')).data.items.map((i: { title: string }) => i.title)).toEqual(['Tema Alfa']);
    expect((await call('/api/scores?keyFifths=2&limit=1')).data.items).toHaveLength(1);
    expect((await call('/api/scores?keyFifths=2&limit=1')).data.total).toBe(2);
  });
});

describe('API: facetas', () => {
  it('devuelve los estilos y tonalidades disponibles para los filtros', async () => {
    const empty = createApp({ service: new ScoreService(new MemoryScoreRepository()), storage: 'memory' });
    const url = await listen(empty);
    expect((await call('/api/facets', { url })).data).toEqual({ styles: [], keys: [] });
    await call('/api/scores', { url, method: 'POST', body: { score: { ...json(exampleScore), style: 'Zamba', originalKey: { fifths: 2, mode: 'minor' } } } });
    const r = await call('/api/facets', { url });
    await close(empty);
    expect(r.status).toBe(200);
    expect(r.data).toEqual({ styles: [{ name: 'Zamba', styleKey: 'zamba', count: 1 }], keys: [{ fifths: 2, mode: 'minor', count: 1 }] });
  });

  it('solo acepta GET', async () => {
    expect((await call('/api/facets', { method: 'POST', body: {} })).status).toBe(405);
  });
});

describe('API: errores', () => {
  it('rechaza JSON inválido, cuerpo vacío y tipo de contenido incorrecto', async () => {
    const invalid = await call('/api/scores', { method: 'POST', raw: '{no es json' });
    expect(invalid.status).toBe(400);
    expect(invalid.data.error.code).toBe('bad_request');
    expect((await call('/api/scores', { method: 'POST', raw: '' })).status).toBe(400);
    const wrongType = await call('/api/scores', { method: 'POST', raw: '{}', contentType: 'text/plain' });
    expect(wrongType.status).toBe(415);
    expect((await call('/api/scores', { method: 'POST', raw: '{}', contentType: null })).status).toBe(415);
  });

  it('una partitura inválida da 422 con la lista de problemas', async () => {
    const bad = json(exampleScore) as unknown as { measures: { elements: { pitch?: { step: string } }[] }[] };
    bad.measures[0]!.elements[0]!.pitch!.step = 'H';
    const r = await call('/api/scores', { method: 'POST', body: { score: bad } });
    expect(r.status).toBe(422);
    expect(r.data.error.code).toBe('validation_error');
    expect(r.data.error.details[0].startsWith('score.measures[0].elements[0].pitch.step')).toBe(true);
    expect((await call('/api/scores', { method: 'POST', body: {} })).status).toBe(422);
    expect((await call('/api/scores', { method: 'POST', body: [1, 2] })).status).toBe(422);
  });

  it('rechaza identificadores inválidos (400) y distingue los que no existen (404)', async () => {
    expect((await call('/api/scores/abc')).status).toBe(400);
    expect((await call('/api/scores/abc', { method: 'DELETE' })).status).toBe(400);
    expect((await call('/api/scores/abc', { method: 'PUT', body: { score: json(exampleScore) } })).status).toBe(400);
    expect((await call('/api/scores/0123456789abcdef01234567')).status).toBe(404);
    expect((await call('/api/scores/%E0%A4%A')).status).toBe(400);
  });

  it('valida los parámetros de la búsqueda', async () => {
    expect((await call('/api/scores?limit=0')).status).toBe(400);
    expect((await call('/api/scores?limit=abc')).status).toBe(400);
    expect((await call('/api/scores?skip=-1')).status).toBe(400);
    expect((await call('/api/scores?keyFifths=9')).status).toBe(400);
    expect((await call('/api/scores?keyMode=dorico')).status).toBe(400);
    expect((await call('/api/scores?q=&style=')).status).toBe(200);
  });

  it('rechaza cuerpos demasiado grandes con 413', async () => {
    const r = await call('/api/scores', { method: 'POST', body: { score: json(exampleScore) }, url: tinyBase });
    expect(r.status).toBe(413);
    expect(r.data.error.code).toBe('payload_too_large');
  });

  it('el error interno no revela detalles', async () => {
    const broken = createApp({
      service: new ScoreService({
        ...new MemoryScoreRepository(),
        list: async () => {
          throw new Error('contraseña=secreto');
        },
      } as unknown as MemoryScoreRepository),
      storage: 'memory',
      log: () => undefined,
    });
    const url = await listen(broken);
    const r = await call('/api/scores', { url });
    await close(broken);
    expect(r.status).toBe(500);
    expect(r.data.error.code).toBe('internal_error');
    expect(JSON.stringify(r.data).includes('secreto')).toBe(false);
  });
});
