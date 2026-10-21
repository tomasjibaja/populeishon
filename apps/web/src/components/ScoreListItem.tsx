import { type ScoreSummaryView, formatKey } from '@partituras/core';
import { pathFor } from '../routing';
import { AppLink } from './AppLink';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });

/** Una partitura de la lista: el título es el enlace para abrirla. */
export function ScoreListItem({
  item,
  current,
  onOpen,
}: {
  item: ScoreSummaryView;
  /** Es la partitura que está abierta. */
  current: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <li className={current ? 'saved-item is-open' : 'saved-item'}>
      <div className="saved-info">
        <AppLink href={pathFor({ name: 'score', id: item.id })} onNavigate={() => onOpen(item.id)} className="score-link">
          {item.title}
        </AppLink>
        <span className="muted">
          {[
            item.composer,
            item.style,
            formatKey(item.originalKey),
            `${item.measureCount} compases`,
            item.hasLyrics ? 'con letra' : undefined,
            formatDate(item.updatedAt),
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>
    </li>
  );
}
