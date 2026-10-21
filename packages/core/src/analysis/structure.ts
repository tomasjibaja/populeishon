import type { Score } from '../model/score';

/** Casilla a la que pertenece un compás. */
export interface EndingInfo {
  readonly label: string;
  readonly numbers: readonly number[];
  /** Este compás es el primero de la casilla. */
  readonly first: boolean;
  /** Este compás es el último de la casilla. */
  readonly last: boolean;
  /** Si la casilla termina con cierre (gancho a la derecha); solo tiene sentido si `last`. */
  readonly closed: boolean;
}

/**
 * Casilla de cada compás (undefined = no está bajo ninguna). Una casilla va desde el compás con
 * `endingStart` hasta el siguiente `endingEnd`; si no se cierra, hasta el compás anterior a la
 * siguiente casilla o hasta el final de la partitura (queda abierta).
 */
export function endingSpans(score: Score): (EndingInfo | undefined)[] {
  const result: (EndingInfo | undefined)[] = [];
  let active: { label: string; numbers: readonly number[] } | undefined;
  const lastIndex = score.measures.length - 1;

  score.measures.forEach((m, index) => {
    if (m.endingStart) {
      const previous = result[index - 1];
      if (active && previous) result[index - 1] = { ...previous, last: true, closed: false };
      active = { label: m.endingStart.label, numbers: m.endingStart.numbers };
      result[index] = { ...active, first: true, last: false, closed: false };
    } else {
      result[index] = active ? { ...active, first: false, last: false, closed: false } : undefined;
    }

    const info = result[index];
    if (info && active) {
      if (m.endingEnd) {
        result[index] = { ...info, last: true, closed: m.endingEnd === 'closed' };
        active = undefined;
      } else if (index === lastIndex) {
        result[index] = { ...info, last: true, closed: false };
      }
    }
  });

  return result;
}
