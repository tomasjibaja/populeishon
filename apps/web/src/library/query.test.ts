import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, PAGE_SIZE, hasActiveFilters, isSearching, keyValue, lastPage, pageInfo, parseKeyValue, sortKeyFacets, toListParams } from './query';

describe('toListParams', () => {
  it('sin filtros pide solo la página', () => {
    expect(toListParams(EMPTY_FILTERS, 0, 20)).toEqual({ limit: 20, skip: 0 });
    expect(toListParams(EMPTY_FILTERS, 2, 20)).toEqual({ limit: 20, skip: 40 });
  });

  it('arma texto, estilo y tonalidad, recortando espacios', () => {
    expect(toListParams({ q: '  Juárez ', style: 'chacarera', key: '1:minor' }, 1, 10)).toEqual({
      q: 'Juárez',
      style: 'chacarera',
      keyFifths: 1,
      keyMode: 'minor',
      limit: 10,
      skip: 10,
    });
  });

  it('ignora un texto en blanco y una tonalidad mal formada', () => {
    expect(toListParams({ q: '   ', style: '', key: 'basura' }, 0, 20)).toEqual({ limit: 20, skip: 0 });
    expect(toListParams(EMPTY_FILTERS, -3, 20).skip).toBe(0);
  });
});

describe('tonalidades como valor de lista', () => {
  it('ida y vuelta', () => {
    expect(keyValue({ fifths: -3, mode: 'minor' })).toBe('-3:minor');
    expect(parseKeyValue('-3:minor')).toEqual({ fifths: -3, mode: 'minor' });
    expect(parseKeyValue('0:major')).toEqual({ fifths: 0, mode: 'major' });
  });

  it('rechaza valores inválidos', () => {
    for (const bad of ['', '9:major', '1:dorico', 'a:major', '1', '1:major:2']) expect(parseKeyValue(bad)).toBe(undefined);
  });
});

describe('páginas', () => {
  it('muestra 30 partituras por página', () => {
    expect(PAGE_SIZE).toBe(30);
  });

  it('describe cada página', () => {
    expect(pageInfo(0, 0, 20)).toEqual({ from: 0, to: 0, hasPrev: false, hasNext: false, pages: 0 });
    expect(pageInfo(57, 0, 20)).toEqual({ from: 1, to: 20, hasPrev: false, hasNext: true, pages: 3 });
    expect(pageInfo(57, 1, 20)).toEqual({ from: 21, to: 40, hasPrev: true, hasNext: true, pages: 3 });
    expect(pageInfo(57, 2, 20)).toEqual({ from: 41, to: 57, hasPrev: true, hasNext: false, pages: 3 });
    expect(pageInfo(20, 0, 20).hasNext).toBe(false);
  });

  it('calcula la última página', () => {
    expect(lastPage(0, 20)).toBe(0);
    expect(lastPage(20, 20)).toBe(0);
    expect(lastPage(21, 20)).toBe(1);
    expect(lastPage(57, 20)).toBe(2);
  });
});

describe('filtros activos y orden de tonalidades', () => {
  it('detecta si hay algún filtro', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, q: ' ' })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, q: 'a' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, style: 'zamba' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, key: '0:major' })).toBe(true);
  });

  it('ordena primero las mayores y dentro de cada modo por la altura de la tónica', () => {
    const sorted = sortKeyFacets([
      { fifths: 1, mode: 'minor', count: 1 },
      { fifths: 2, mode: 'major', count: 1 },
      { fifths: 0, mode: 'minor', count: 1 },
      { fifths: -1, mode: 'major', count: 1 },
      { fifths: 0, mode: 'major', count: 1 },
    ]);
    // mayores por la tónica: C, D, F; menores: E, A
    expect(sorted.map((k) => keyValue(k))).toEqual(['0:major', '2:major', '-1:major', '1:minor', '0:minor']);
  });

  it('la biblioteca solo se muestra al buscar o al pedir verlas todas', () => {
    expect(isSearching(EMPTY_FILTERS, false)).toBe(false);
    expect(isSearching(EMPTY_FILTERS, true)).toBe(true);
    expect(isSearching({ ...EMPTY_FILTERS, q: 'nostalgiosa' }, false)).toBe(true);
    expect(isSearching({ ...EMPTY_FILTERS, key: '1:minor' }, false)).toBe(true);
    expect(isSearching({ ...EMPTY_FILTERS, q: '  ' }, false)).toBe(false);
  });
});
