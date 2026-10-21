import { exampleScore, longExampleScore, type Score } from '@partituras/core';
import { describe, expect, it } from 'vitest';
import { MemoryScoreRepository } from '../storage/memoryRepository';
import { DomainError } from './errors';
import { normalizeForSearch } from './normalize';
import { ScoreService } from './scoreService';

const json = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const nobody = { ownerId: null };
const wait = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

function makeService() {
  return new ScoreService(new MemoryScoreRepository());
}

const scoreWith = (changes: Partial<Score>): Score => json({ ...exampleScore, ...changes }) as Score;

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'no_error';
  } catch (error) {
    return error instanceof DomainError ? error.code : 'other_error';
  }
}

describe('normalizeForSearch', () => {
  it('quita tildes y mayúsculas', () => {
    expect(normalizeForSearch('  Fortunato   JUÁREZ ')).toBe('fortunato juarez');
    expect(normalizeForSearch('Ñandú')).toBe('nandu');
  });
});

describe('ScoreService: crear y leer', () => {
  it('guarda una partitura y devuelve el documento con sus campos derivados', async () => {
    const service = makeService();
    const { document, warnings } = await service.create({ score: json(longExampleScore) }, nobody);
    expect(/^[0-9a-f]{24}$/.test(document.id)).toBe(true);
    expect(document.title).toBe('Melodía de ejemplo larga');
    expect(document.measureCount).toBe(33);
    expect(document.originalKey).toEqual({ fifths: 0, mode: 'major' });
    expect(document.hasLyrics).toBe(false);
    expect(document.source).toEqual({ kind: 'builtin', hasMusicXml: false });
    expect(document.ownerId).toBe(null);
    expect(document.score).toEqual(longExampleScore);
    expect(warnings).toHaveLength(0);
    expect(await service.get(document.id, nobody)).toEqual(document);
  });

  it('rechaza una partitura mal formada con el detalle de cada problema', async () => {
    const service = makeService();
    const bad = json(exampleScore) as unknown as { title: string; measures: unknown[] };
    bad.title = '';
    bad.measures = [];
    try {
      await service.create({ score: bad }, nobody);
      expect('no_error').toBe('validation_error');
    } catch (error) {
      expect(error instanceof DomainError && error.code).toBe('validation_error');
      expect(error instanceof DomainError && (error.details?.length ?? 0) >= 2).toBe(true);
    }
    expect(await codeOf(service.create('hola', nobody))).toBe('validation_error');
    expect(await codeOf(service.create({}, nobody))).toBe('validation_error');
    expect(await codeOf(service.create({ score: json(exampleScore), source: { kind: 'otro' } }, nobody))).toBe('validation_error');
  });

  it('un problema musical no impide guardar: se informa como aviso', async () => {
    const service = makeService();
    const incomplete = json(exampleScore) as unknown as { measures: { elements: unknown[] }[] };
    incomplete.measures[0]!.elements = incomplete.measures[0]!.elements.slice(0, 1);
    const { warnings } = await service.create({ score: incomplete }, nobody);
    expect(warnings.length >= 1).toBe(true);
  });

  it('descarta lo que no es parte del modelo', async () => {
    const service = makeService();
    const dirty = { ...json(exampleScore), $where: '1', hack: true } as unknown;
    const { document } = await service.create({ score: dirty }, nobody);
    expect(JSON.stringify(document.score).includes('hack')).toBe(false);
    expect(JSON.stringify(document.score).includes('$where')).toBe(false);
  });
});

describe('ScoreService: la letra', () => {
  it('conserva los saltos de línea y las estrofas, y los normaliza', async () => {
    const service = makeService();
    const lyrics = 'Verso uno\r\nVerso dos\n\nOtra estrofa\nÚltimo verso';
    const { document } = await service.create({ score: scoreWith({ lyrics }) }, nobody);
    expect(document.score.lyrics).toBe('Verso uno\nVerso dos\n\nOtra estrofa\nÚltimo verso');
    expect(document.hasLyrics).toBe(true);
    const read = await service.get(document.id, nobody);
    expect(read.score.lyrics?.split('\n')).toEqual(['Verso uno', 'Verso dos', '', 'Otra estrofa', 'Último verso']);
  });

  it('se puede agregar, cambiar y quitar la letra al reemplazar', async () => {
    const service = makeService();
    const { document } = await service.create({ score: json(exampleScore) }, nobody);
    expect(document.hasLyrics).toBe(false);
    const withLyrics = await service.replace(document.id, { score: scoreWith({ lyrics: 'Una\nLetra' }) }, nobody);
    expect(withLyrics.document.hasLyrics).toBe(true);
    const without = await service.replace(document.id, { score: json(exampleScore) }, nobody);
    expect(without.document.hasLyrics).toBe(false);
    expect(without.document.score.lyrics).toBe(undefined);
  });
});

describe('ScoreService: origen y MusicXML original', () => {
  it('guarda el archivo original aparte y no lo incluye en el documento', async () => {
    const service = makeService();
    const xml = '<score-partwise><part-list/></score-partwise>';
    const { document } = await service.create(
      { score: json(exampleScore), source: { kind: 'musicxml', fileName: 'mi tema.musicxml', musicXml: xml } },
      nobody,
    );
    expect(document.source.kind).toBe('musicxml');
    expect(document.source.fileName).toBe('mi tema.musicxml');
    expect(document.source.hasMusicXml).toBe(true);
    expect(typeof document.source.importedAt).toBe('string');
    expect(JSON.stringify(document).includes('part-list')).toBe(false);
    expect(await service.getMusicXml(document.id, nobody)).toBe(xml);
  });

  it('sin XML original, pedirlo da "no encontrado"', async () => {
    const service = makeService();
    const { document } = await service.create({ score: json(exampleScore) }, nobody);
    expect(await codeOf(service.getMusicXml(document.id, nobody))).toBe('not_found');
  });
});

describe('ScoreService: listar, buscar y filtrar', () => {
  async function library() {
    const service = makeService();
    const make = async (title: string, composer: string | undefined, style: string | undefined, fifths: number, mode: 'major' | 'minor') => {
      await service.create(
        { score: scoreWith({ title, ...(composer ? { composer } : {}), ...(style ? { style } : {}), originalKey: { fifths, mode } }) },
        nobody,
      );
      await wait();
    };
    await make('Bien haiga con el mocito', 'Fortunato Juárez', 'Chacarera', 1, 'minor');
    await make('El coyuyo y la tortuga', 'Peteco Carabajal', 'Escondido', 1, 'major');
    await make('La nostalgiosa', 'E. Falú / J. Dávalos', undefined, 0, 'major');
    await make('Chacarera del rancho', 'Fortunato Juárez', 'Chacarera', -1, 'major');
    return service;
  }

  it('lista de la más reciente a la más antigua, con total y paginación', async () => {
    const service = await library();
    const all = await service.list({}, nobody);
    expect(all.total).toBe(4);
    expect(all.items.map((i) => i.title)).toEqual(['Chacarera del rancho', 'La nostalgiosa', 'El coyuyo y la tortuga', 'Bien haiga con el mocito']);
    const page = await service.list({ limit: 2, skip: 1 }, nobody);
    expect(page.items.map((i) => i.title)).toEqual(['La nostalgiosa', 'El coyuyo y la tortuga']);
    expect(page.total).toBe(4);
    expect(page.limit).toBe(2);
    expect(page.skip).toBe(1);
  });

  it('el listado trae el resumen, no la partitura completa', async () => {
    const service = await library();
    const first = (await service.list({}, nobody)).items[0]!;
    expect(Object.keys(first).includes('score')).toBe(false);
    expect(first.measureCount).toBe(8);
    expect(first.sourceKind).toBe('builtin');
  });

  it('busca por título o autor, sin importar mayúsculas ni tildes', async () => {
    const service = await library();
    const titles = async (q: string) => (await service.list({ q }, nobody)).items.map((i) => i.title).sort();
    expect(await titles('JUAREZ')).toEqual(['Bien haiga con el mocito', 'Chacarera del rancho']);
    expect(await titles('coyuyo')).toEqual(['El coyuyo y la tortuga']);
    expect(await titles('falu')).toEqual(['La nostalgiosa']);
    expect(await titles('no existe')).toEqual([]);
  });

  it('filtra por estilo y por tonalidad', async () => {
    const service = await library();
    expect((await service.list({ style: 'chacarera' }, nobody)).total).toBe(2);
    expect((await service.list({ style: 'ESCONDIDO' }, nobody)).total).toBe(1);
    expect((await service.list({ keyFifths: 1 }, nobody)).total).toBe(2);
    expect((await service.list({ keyFifths: 1, keyMode: 'minor' }, nobody)).items.map((i) => i.title)).toEqual(['Bien haiga con el mocito']);
    expect((await service.list({ keyMode: 'major' }, nobody)).total).toBe(3);
    expect((await service.list({ q: 'juarez', style: 'chacarera', keyMode: 'major' }, nobody)).items.map((i) => i.title)).toEqual(['Chacarera del rancho']);
  });

  it('acota el tamaño de página', async () => {
    const service = await library();
    expect((await service.list({ limit: 1000 }, nobody)).limit).toBe(100);
    expect((await service.list({ limit: 0 }, nobody)).limit).toBe(1);
  });
});

describe('ScoreService: facetas para los filtros', () => {
  it('lista los estilos y las tonalidades que hay, con su cantidad', async () => {
    const service = makeService();
    const add = (style: string | undefined, fifths: number, mode: 'major' | 'minor') =>
      service.create({ score: scoreWith({ style, originalKey: { fifths, mode } }) }, nobody);
    await add('Zamba', 1, 'minor');
    await add('chacarera', 1, 'major');
    await add('Chacarera', 1, 'major');
    await add(undefined, 0, 'major');
    const facets = await service.facets(nobody);
    expect(facets.styles).toEqual([
      { name: 'chacarera', styleKey: 'chacarera', count: 2 },
      { name: 'Zamba', styleKey: 'zamba', count: 1 },
    ]);
    expect(facets.keys).toEqual([
      { fifths: 0, mode: 'major', count: 1 },
      { fifths: 1, mode: 'major', count: 2 },
      { fifths: 1, mode: 'minor', count: 1 },
    ]);
  });

  it('está vacía sin partituras y solo cuenta las del dueño', async () => {
    const service = makeService();
    expect(await service.facets(nobody)).toEqual({ styles: [], keys: [] });
    await service.create({ score: scoreWith({ style: 'Zamba' }) }, { ownerId: 'otro' });
    expect(await service.facets(nobody)).toEqual({ styles: [], keys: [] });
    expect((await service.facets({ ownerId: 'otro' })).styles).toHaveLength(1);
  });
});

describe('ScoreService: reemplazar y borrar', () => {
  it('reemplaza la partitura, recalcula los campos derivados y conserva fecha de creación y XML', async () => {
    const service = makeService();
    const created = await service.create(
      { score: json(exampleScore), source: { kind: 'musicxml', musicXml: '<score-partwise/>' } },
      nobody,
    );
    await wait(10);
    const { document } = await service.replace(created.document.id, { score: scoreWith({ title: 'Título nuevo', style: 'Zamba' }) }, nobody);
    expect(document.id).toBe(created.document.id);
    expect(document.title).toBe('Título nuevo');
    expect(document.style).toBe('Zamba');
    expect(document.createdAt).toBe(created.document.createdAt);
    expect(document.updatedAt > created.document.updatedAt).toBe(true);
    expect(document.source.hasMusicXml).toBe(true);
    expect(await service.getMusicXml(document.id, nobody)).toBe('<score-partwise/>');
    expect((await service.list({ q: 'titulo nuevo' }, nobody)).total).toBe(1);
  });

  it('puede reemplazar también el origen', async () => {
    const service = makeService();
    const created = await service.create({ score: json(exampleScore) }, nobody);
    const { document } = await service.replace(
      created.document.id,
      { score: json(exampleScore), source: { kind: 'musicxml', fileName: 'otro.musicxml', musicXml: '<otro/>' } },
      nobody,
    );
    expect(document.source.fileName).toBe('otro.musicxml');
    expect(await service.getMusicXml(document.id, nobody)).toBe('<otro/>');
  });

  it('borra y después ya no existe', async () => {
    const service = makeService();
    const { document } = await service.create({ score: json(exampleScore) }, nobody);
    await service.remove(document.id, nobody);
    expect(await codeOf(service.get(document.id, nobody))).toBe('not_found');
    expect(await codeOf(service.remove(document.id, nobody))).toBe('not_found');
    expect((await service.list({}, nobody)).total).toBe(0);
  });

  it('distingue un identificador inválido de uno que no existe', async () => {
    const service = makeService();
    expect(await codeOf(service.get('abc', nobody))).toBe('bad_request');
    expect(await codeOf(service.remove('../../etc', nobody))).toBe('bad_request');
    expect(await codeOf(service.replace('zzzzzzzzzzzzzzzzzzzzzzzz', { score: json(exampleScore) }, nobody))).toBe('bad_request');
    expect(await codeOf(service.get('0123456789abcdef01234567', nobody))).toBe('not_found');
    expect(await codeOf(service.replace('0123456789abcdef01234567', { score: json(exampleScore) }, nobody))).toBe('not_found');
  });
});

describe('ScoreService: preparado para usuarios', () => {
  it('cada dueño ve solo sus partituras', async () => {
    const service = makeService();
    const mine = { ownerId: 'usuario-1' };
    const theirs = { ownerId: 'usuario-2' };
    const created = await service.create({ score: json(exampleScore) }, mine);
    expect(created.document.ownerId).toBe('usuario-1');
    expect((await service.list({}, mine)).total).toBe(1);
    expect((await service.list({}, theirs)).total).toBe(0);
    expect((await service.list({}, nobody)).total).toBe(0);
    expect(await codeOf(service.get(created.document.id, theirs))).toBe('not_found');
    expect(await codeOf(service.replace(created.document.id, { score: json(exampleScore) }, theirs))).toBe('not_found');
    expect(await codeOf(service.remove(created.document.id, theirs))).toBe('not_found');
    await service.remove(created.document.id, mine);
  });
});
