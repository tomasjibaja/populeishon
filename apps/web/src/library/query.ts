import { type Key, type Mode, type ScoreFacets, allKeys } from '@partituras/core';
import type { ListParams } from '../api/scoresApi';

/** Filtros de la biblioteca tal como los elige el usuario. */
export interface LibraryFilters {
  /** Texto buscado en título o autor. */
  readonly q: string;
  /** `styleKey` del estilo elegido, o ''. */
  readonly style: string;
  /** Tonalidad elegida como "fifths:mode" (ver `keyValue`), o ''. */
  readonly key: string;
}

export const EMPTY_FILTERS: LibraryFilters = { q: '', style: '', key: '' };
/** Cantidad de partituras por página (en la biblioteca y en los resultados de la búsqueda). */
export const PAGE_SIZE = 30;

export const hasActiveFilters = (filters: LibraryFilters): boolean =>
  filters.q.trim() !== '' || filters.style !== '' || filters.key !== '';

/** La biblioteca solo muestra resultados cuando se busca (texto o filtros) o se pide verlas todas. */
export const isSearching = (filters: LibraryFilters, showAll: boolean): boolean => showAll || hasActiveFilters(filters);

export const keyValue = (key: Key): string => `${key.fifths}:${key.mode}`;

export function parseKeyValue(value: string): Key | undefined {
  const match = /^(-?\d+):(major|minor)$/.exec(value);
  if (!match) return undefined;
  const fifths = Number(match[1]);
  return Number.isInteger(fifths) && fifths >= -7 && fifths <= 7 ? { fifths, mode: match[2] as Mode } : undefined;
}

/** Parámetros de la petición para una página de resultados (la primera es la 0). */
export function toListParams(filters: LibraryFilters, page: number, pageSize: number): ListParams {
  const q = filters.q.trim();
  const key = parseKeyValue(filters.key);
  return {
    ...(q ? { q } : {}),
    ...(filters.style ? { style: filters.style } : {}),
    ...(key ? { keyFifths: key.fifths, keyMode: key.mode } : {}),
    limit: pageSize,
    skip: Math.max(page, 0) * pageSize,
  };
}

export const lastPage = (total: number, pageSize: number): number => Math.max(0, Math.ceil(total / pageSize) - 1);

export interface PageInfo {
  /** Posición (empezando en 1) del primer y del último resultado de la página; 0 si no hay. */
  readonly from: number;
  readonly to: number;
  readonly hasPrev: boolean;
  readonly hasNext: boolean;
  readonly pages: number;
}

export function pageInfo(total: number, page: number, pageSize: number): PageInfo {
  if (total === 0) return { from: 0, to: 0, hasPrev: false, hasNext: false, pages: 0 };
  const from = page * pageSize + 1;
  return {
    from,
    to: Math.min(total, (page + 1) * pageSize),
    hasPrev: page > 0,
    hasNext: (page + 1) * pageSize < total,
    pages: Math.ceil(total / pageSize),
  };
}

/** Tonalidades disponibles en el orden de la lista de tonalidades (por modo y por la tónica). */
export function sortKeyFacets(keys: ScoreFacets['keys']): ScoreFacets['keys'] {
  const order = new Map<string, number>();
  (['major', 'minor'] as const).forEach((mode, m) =>
    allKeys(mode).forEach((k, i) => order.set(keyValue(k), m * 100 + i)),
  );
  return [...keys].sort((a, b) => (order.get(keyValue(a)) ?? 0) - (order.get(keyValue(b)) ?? 0));
}
