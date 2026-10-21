import { type Score, formatKey, formatTimeSignature } from '@partituras/core';

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export function ScoreHeader({ score }: { score: Score }) {
  const key = score.transposition
    ? `${formatKey(score.originalKey)} (transpuesta desde ${formatKey(score.transposition.from)}, ${signed(score.transposition.semitones)} semitonos)`
    : formatKey(score.originalKey);
  const details = [
    key,
    formatTimeSignature(score.timeSignature),
    `${score.measures.length} compases`,
    score.tempo ? `${score.tempo.bpm} negras por minuto` : undefined,
  ].filter(Boolean);

  return (
    <header className="score-header">
      <p className="meta">{details.join(' · ')}</p>
    </header>
  );
}
