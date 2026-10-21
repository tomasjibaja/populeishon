import { useEffect, useState } from 'react';
import type { Library } from '../hooks/useLibrary';
import { EMPTY_FILTERS, isSearching, pageInfo } from '../library/query';
import { pathFor } from '../routing';
import { AppLink } from './AppLink';
import { ScoreListItem } from './ScoreListItem';

interface Props {
  library: Library;
  /** Id de la partitura guardada que está abierta, si hay una. */
  currentId: string | undefined;
  onOpen: (id: string) => void;
  onOpenLibrary: () => void;
}

const SEARCH_DELAY_MS = 300;

/**
 * Búsqueda: una barra (título o autor) y un desplegable de estilo. Los resultados aparecen al buscar o al elegir un
 * estilo; las partituras se abren tocando el título. La lista completa está en la pantalla de la biblioteca.
 */
export function LibraryPanel({ library, currentId, onOpen, onOpenLibrary }: Props) {
  const { filters, facets } = library;
  const [text, setText] = useState(filters.q);

  // La búsqueda por texto espera un instante después de tipear para no pedir en cada letra.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (text !== filters.q) library.setFilters({ q: text });
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [text]);

  const searching = isSearching(filters, false);
  const info = pageInfo(library.total, library.page, library.pageSize);

  // Un estilo por cada uno que haya guardado en la base de datos.
  const styles = facets?.styles ?? [];
  // Si el estilo elegido ya no tiene partituras (se borraron), igual se muestra para poder quitarlo.
  const selectedStyleMissing = filters.style !== '' && !styles.some((s) => s.styleKey === filters.style);

  function clear() {
    setText('');
    library.setFilters(EMPTY_FILTERS);
  }

  return (
    <section className="library" aria-label="Búsqueda">
      <div className="library-bar">
        <label className="library-search-bar">
          <span className="sr-only">Buscar partituras</span>
          <input
            type="search"
            value={text}
            placeholder="Buscar en tus partituras por título o autor…"
            onChange={(event) => setText(event.target.value)}
          />
        </label>

        <label className="control library-style">
          <span className="control-text">Estilo</span>
          <select value={filters.style} onChange={(event) => library.setFilters({ style: event.target.value })}>
            <option value="">Sin filtro</option>
            {selectedStyleMissing && <option value={filters.style}>{filters.style}</option>}
            {styles.map((style) => (
              <option key={style.styleKey} value={style.styleKey}>
                {style.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* ADMIN-PANEL: filtro por tonalidad (la lista de tonalidades existentes sale de library.facets.keys)
      <label className="control">
        Tonalidad
        <select value={filters.key} onChange={(event) => library.setFilters({ key: event.target.value })}>
          <option value="">Todas</option>
          {keys.map((key) => (
            <option key={keyValue(key)} value={keyValue(key)}>
              {formatKey(key)} ({key.count})
            </option>
          ))}
        </select>
      </label>
      */}

      {!searching && (
        <p className="muted">
          Escribí para buscar, elegí un estilo o{' '}
          <AppLink href={pathFor({ name: 'library' })} onNavigate={onOpenLibrary} className="score-link">
            ir a la biblioteca
          </AppLink>
          .
        </p>
      )}

      {searching && (
        <div className="library-results">
          <p className="muted">
            {library.status === 'ready' ? `${library.total} resultado${library.total === 1 ? '' : 's'}` : ''}{' '}
            <button type="button" className="link-button" onClick={clear}>
              Cerrar búsqueda
            </button>
          </p>

          {library.status === 'loading' && <p className="muted">Buscando…</p>}

          {library.status === 'error' && (
            <p className="status status-error" role="alert">
              {library.error}{' '}
              <button type="button" className="link-button" onClick={() => void library.refresh()}>
                Reintentar
              </button>
            </p>
          )}

          {library.status === 'ready' && library.items.length === 0 && <p className="muted">No se encontró ninguna partitura.</p>}

          {library.items.length > 0 && (
            <ul className="saved-list">
              {library.items.map((item) => (
                <ScoreListItem key={item.id} item={item} current={item.id === currentId} onOpen={onOpen} />
              ))}
            </ul>
          )}

          {info.pages > 1 && (
            <nav className="pager" aria-label="Páginas de resultados">
              <button type="button" className="button-small-text" disabled={!info.hasPrev} onClick={() => library.setPage(library.page - 1)}>
                ‹ Anteriores
              </button>
              <span className="muted">
                {info.from}–{info.to} de {library.total}
              </span>
              <button type="button" className="button-small-text" disabled={!info.hasNext} onClick={() => library.setPage(library.page + 1)}>
                Siguientes ›
              </button>
            </nav>
          )}
        </div>
      )}
    </section>
  );
}
