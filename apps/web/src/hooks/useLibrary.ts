import type { ScoreFacets, ScoreSummaryView } from '@partituras/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type ScoreStore, messageOf } from '../api/scoresApi';
import { EMPTY_FILTERS, type LibraryFilters, PAGE_SIZE, lastPage, toListParams } from '../library/query';

interface ListState {
  readonly status: 'loading' | 'ready' | 'error';
  readonly items: readonly ScoreSummaryView[];
  readonly total: number;
  readonly error?: string;
}

export interface Library extends ListState {
  readonly filters: LibraryFilters;
  /** Página actual (la primera es la 0). */
  readonly page: number;
  readonly pageSize: number;
  /** Estilos y tonalidades disponibles para los filtros (null mientras no llegan). */
  readonly facets: ScoreFacets | null;
  /** Cambia los filtros y vuelve a la primera página. */
  setFilters: (changes: Partial<LibraryFilters>) => void;
  setPage: (page: number) => void;
  /** Vuelve a pedir el listado y los filtros (después de guardar o eliminar). */
  refresh: () => Promise<void>;
}

/** Biblioteca de partituras guardadas: listado con búsqueda, filtros y páginas. */
export function useLibrary(store: ScoreStore): Library {
  const [filters, setFiltersState] = useState<LibraryFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [list, setList] = useState<ListState>({ status: 'loading', items: [], total: 0 });
  const [facets, setFacets] = useState<ScoreFacets | null>(null);
  // Si llegan respuestas fuera de orden (se tipea rápido), solo vale la última pedida.
  const latest = useRef(0);

  const load = useCallback(
    async (currentFilters: LibraryFilters, currentPage: number) => {
      latest.current += 1;
      const requestId = latest.current;
      try {
        const result = await store.list(toListParams(currentFilters, currentPage, PAGE_SIZE));
        if (requestId !== latest.current) return;
        if (result.items.length === 0 && result.total > 0 && currentPage > 0) {
          // Se borró lo último de esa página: se vuelve a la última que tiene resultados.
          setPage(lastPage(result.total, PAGE_SIZE));
          return;
        }
        setList({ status: 'ready', items: result.items, total: result.total });
      } catch (error) {
        if (requestId !== latest.current) return;
        setList({ status: 'error', items: [], total: 0, error: messageOf(error) });
      }
    },
    [store],
  );

  const loadFacets = useCallback(async () => {
    try {
      setFacets(await store.facets());
    } catch {
      // Sin facetas los filtros de estilo y tonalidad quedan vacíos; el listado ya informa el error.
    }
  }, [store]);

  useEffect(() => {
    void load(filters, page);
  }, [load, filters, page]);

  useEffect(() => {
    void loadFacets();
  }, [loadFacets]);

  const refresh = useCallback(async () => {
    await Promise.all([load(filters, page), loadFacets()]);
  }, [load, loadFacets, filters, page]);

  const setFilters = useCallback((changes: Partial<LibraryFilters>) => {
    setFiltersState((previous) => ({ ...previous, ...changes }));
    setPage(0);
  }, []);

  return { ...list, filters, page, pageSize: PAGE_SIZE, facets, setFilters, setPage, refresh };
}
