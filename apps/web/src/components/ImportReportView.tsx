import type { ImportReportItem, ImportResult } from '@partituras/core';

const LABEL: Record<ImportReportItem['severity'], string> = { error: 'Error', warning: 'Aviso', info: 'Nota' };
const RANK: Record<ImportReportItem['severity'], number> = { error: 0, warning: 1, info: 2 };

export function ImportReportView({ result, onDismiss }: { result: ImportResult; onDismiss: () => void }) {
  const { report } = result;
  const items = report.items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => RANK[a.item.severity] - RANK[b.item.severity] || a.index - b.index);
  const warningCount = report.items.filter((i) => i.severity === 'warning').length;

  const heading = !result.ok
    ? 'No se pudo importar'
    : warningCount > 0
      ? `Importado con ${warningCount} aviso${warningCount === 1 ? '' : 's'}`
      : 'Importado correctamente';
  const tone = !result.ok ? 'is-error' : warningCount > 0 ? 'is-warning' : 'is-ok';

  return (
    <section className={`import-report ${tone}`} aria-live="polite">
      <div className="import-report-head">
        <h2>
          {heading}
          {report.fileName ? `: ${report.fileName}` : ''}
        </h2>
        <button type="button" className="link-button" onClick={onDismiss}>
          Ocultar
        </button>
      </div>
      <ul>
        {items.map(({ item, index }) => (
          <li key={index} className={`item item-${item.severity}`}>
            <strong>{LABEL[item.severity]}</strong>
            {item.measure !== undefined ? ` (compás ${item.measure})` : ''}: {item.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
