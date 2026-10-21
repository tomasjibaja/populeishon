import type { Tie } from '@partituras/core';

export interface TieElement {
  readonly isNote: boolean;
  readonly tie?: Tie;
  /** Identifica la altura (p. ej. 'g/4'); solo se une una nota con otra igual. */
  readonly pitchKey?: string;
}

export interface TiePair {
  readonly from: number;
  readonly to: number;
}

export interface TieResult {
  readonly pairs: TiePair[];
  /** Notas con una ligadura que no encuentra su otro extremo. */
  readonly unmatched: number[];
}

const OPENS = (t: Tie | undefined) => t === 'start' || t === 'continue';
const CLOSES = (t: Tie | undefined) => t === 'stop' || t === 'continue';

/**
 * Empareja cada nota que abre una ligadura con la nota inmediatamente siguiente
 * (cruzando compases) que la cierra y tiene la misma altura.
 */
export function pairTies(elements: readonly TieElement[]): TieResult {
  const pairs: TiePair[] = [];
  const unmatched: number[] = [];
  const closed = new Set<number>();

  elements.forEach((el, i) => {
    if (!el.isNote || !OPENS(el.tie)) return;
    const next = elements[i + 1];
    if (next && next.isNote && CLOSES(next.tie) && next.pitchKey === el.pitchKey) {
      pairs.push({ from: i, to: i + 1 });
      closed.add(i + 1);
    } else {
      unmatched.push(i);
    }
  });

  elements.forEach((el, i) => {
    if (el.isNote && CLOSES(el.tie) && !closed.has(i)) unmatched.push(i);
  });

  return { pairs, unmatched };
}
