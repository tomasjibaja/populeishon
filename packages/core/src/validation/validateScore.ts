import { effectiveTimeSignatures, measureDuration } from '../analysis/analysis';
import { formatDuration, formatTimeSignature } from '../format/format';
import { type Duration, ZERO_DURATION, addDuration, compareDuration } from '../model/duration';
import type { Score } from '../model/score';
import { measureCapacity } from '../model/timeSignature';

export interface ValidationIssue {
  /** Número de compás afectado; ausente si el problema es de toda la partitura. */
  readonly measure?: number;
  readonly message: string;
}

/**
 * Revisa la coherencia interna de una partitura.
 * Todos los compases deben estar completos, salvo la anacrusa (primer compás marcado
 * como `pickup`) y el último compás cuando completa la anacrusa.
 */
export function validateScore(score: Score): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (score.measures.length === 0) {
    return [{ message: 'La partitura no tiene compases.' }];
  }

  const signatures = effectiveTimeSignatures(score);
  const first = score.measures[0];
  const pickupDuration = first?.pickup ? measureDuration(first) : undefined;
  const lastIndex = score.measures.length - 1;

  score.measures.forEach((m, index) => {
    const ts = signatures[index];
    if (!ts) return;

    const capacity = measureCapacity(ts);
    const actual = measureDuration(m);

    if (m.pickup) {
      if (index !== 0) {
        issues.push({ measure: m.number, message: `Compás ${m.number}: solo el primer compás puede ser una anacrusa.` });
      } else if (compareDuration(actual, ZERO_DURATION) <= 0 || compareDuration(actual, capacity) >= 0) {
        issues.push({
          measure: m.number,
          message: `Compás ${m.number}: la anacrusa debe durar menos que un compás completo (dura ${formatDuration(actual)}, un compás son ${formatDuration(capacity)}).`,
        });
      }
    } else if (compareDuration(actual, capacity) !== 0) {
      const completesPickup =
        index === lastIndex &&
        pickupDuration !== undefined &&
        compareDuration(addDuration(actual, pickupDuration), capacity) === 0;
      if (!completesPickup) {
        issues.push({
          measure: m.number,
          message: `Compás ${m.number}: suma ${formatDuration(actual)} y en ${formatTimeSignature(ts)} debería sumar ${formatDuration(capacity)}.`,
        });
      }
    }

    let previous: Duration | undefined;
    for (const { offset } of m.chords) {
      if (compareDuration(offset, capacity) >= 0) {
        issues.push({
          measure: m.number,
          message: `Compás ${m.number}: un acorde empieza fuera del compás (posición ${formatDuration(offset)}).`,
        });
      }
      if (previous && compareDuration(offset, previous) <= 0) {
        issues.push({
          measure: m.number,
          message: `Compás ${m.number}: los acordes deben estar ordenados y sin repetir posición.`,
        });
      }
      previous = offset;
    }
  });

  // Casillas: cada una debe cerrarse antes de abrir otra, y no puede cerrarse sin haberse abierto.
  let open: number | undefined;
  for (const m of score.measures) {
    if (m.endingStart) {
      if (open !== undefined) {
        issues.push({ measure: open, message: `Compás ${open}: la casilla "${score.measures.find((x) => x.number === open)?.endingStart?.label ?? ''}" no se cierra antes de empezar otra.` });
      }
      open = m.number;
    }
    if (m.endingEnd) {
      if (open === undefined) {
        issues.push({ measure: m.number, message: `Compás ${m.number}: se cierra una casilla que no empezó.` });
      }
      open = undefined;
    }
  }
  if (open !== undefined) {
    issues.push({ measure: open, message: `Compás ${open}: la casilla no se cierra.` });
  }

  return issues;
}
