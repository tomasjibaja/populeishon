import { pageInfo } from '../library/query';
import { scoreStore } from '../api/scoresApi';
import { useLibrary } from '../hooks/useLibrary';
import { AppLink } from './AppLink';
import { ScoreListItem } from './ScoreListItem';

/** La biblioteca completa, de a 30 partituras por página. */
export function LibraryPage({ currentId, onOpen, onBack }: { currentId: string | undefined; onOpen: (id: string) => void; onBack: () => void }) {
  const library = useLibrary(scoreStore);
  const info = pageInfo(library.total, library.page, library.pageSize);

  return (
    <section className="library-page" aria-label="Biblioteca completa">
      <div className="library-page-head">
        <AppLink href="/" onNavigate={onBack} className="back-link">
          ← Volver
        </AppLink>
        <h1>Biblioteca</h1>
        {library.status === 'ready' && (
          <span className="muted">
            {library.total} partitura{library.total === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {library.status === 'loading' && (
        <p className="loading" role="status">
          <span className="spinner" aria-hidden="true" />
          Cargando…
        </p>
      )}

      {library.status === 'error' && (
        <p className="status status-error" role="alert">
          {library.error}{' '}
          <button type="button" className="link-button" onClick={() => void library.refresh()}>
            Reintentar
          </button>
        </p>
      )}

      {library.status === 'ready' && library.items.length === 0 && <p className="muted">Todavía no hay partituras guardadas.</p>}

      {library.items.length > 0 && (
        <ul className="saved-list library-full-list">
          {library.items.map((item) => (
            <ScoreListItem key={item.id} item={item} current={item.id === currentId} onOpen={onOpen} />
          ))}
        </ul>
      )}

      {info.pages > 1 && (
        <nav className="pager" aria-label="Páginas de la biblioteca">
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
    </section>
  );
}
