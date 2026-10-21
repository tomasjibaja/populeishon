import {
  type Score,
  effectiveTimeSignatures,
  formatBeat,
  formatChord,
  formatElement,
  formatStructure,
} from '@partituras/core';

export function MeasureTable({ score }: { score: Score }) {
  const signatures = effectiveTimeSignatures(score);

  return (
    <table className="measures">
      <caption>Contenido del modelo, compás por compás</caption>
      <thead>
        <tr>
          <th scope="col">Compás</th>
          <th scope="col">Acordes</th>
          <th scope="col">Notas y silencios</th>
          <th scope="col">Estructura</th>
        </tr>
      </thead>
      <tbody>
        {score.measures.map((m, index) => {
          const ts = signatures[index] ?? score.timeSignature;
          return (
            <tr key={m.number}>
              <th scope="row">{m.pickup ? 'anacrusa' : m.number}</th>
              <td>
                {m.chords.length === 0
                  ? 'Sin acorde'
                  : m.chords
                      .map(({ offset, chord }) => {
                        const beat = formatBeat(offset, ts);
                        return beat === '1' ? formatChord(chord) : `${formatChord(chord)} (tiempo ${beat})`;
                      })
                      .join(', ')}
              </td>
              <td>{m.elements.map(formatElement).join(', ')}</td>
              <td>{formatStructure(m).join(', ')}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
