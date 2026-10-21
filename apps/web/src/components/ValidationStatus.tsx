import type { ValidationIssue } from '@partituras/core';

export function ValidationStatus({ issues }: { issues: readonly ValidationIssue[] }) {
  if (issues.length === 0) {
    return <p className="status status-ok">Todos los compases tienen la duración correcta.</p>;
  }
  return (
    <div className="status status-error" role="alert">
      <p>Se encontraron {issues.length} problemas en la partitura:</p>
      <ul>
        {issues.map((issue, i) => (
          <li key={i}>{issue.message}</li>
        ))}
      </ul>
    </div>
  );
}
