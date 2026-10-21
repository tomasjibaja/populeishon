export const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type Step = (typeof STEPS)[number];

/**
 * Nombre de nota "escrito" (spelled): C# y Db son distintos.
 * `alter` en semitonos: -2 (doble bemol) … +2 (doble sostenido).
 */
export interface PitchClass {
  readonly step: Step;
  readonly alter: number;
}

/** Altura completa. La octava sigue la convención científica (C4 = do central). */
export interface Pitch extends PitchClass {
  readonly octave: number;
}

export function pitchClass(step: Step, alter = 0): PitchClass {
  if (!Number.isInteger(alter) || alter < -2 || alter > 2) {
    throw new RangeError(`Alteración fuera de rango (-2 a 2): ${alter}.`);
  }
  return { step, alter };
}

export function pitch(step: Step, octave: number, alter = 0): Pitch {
  if (!Number.isInteger(octave) || octave < -1 || octave > 9) {
    throw new RangeError(`Octava fuera de rango (-1 a 9): ${octave}.`);
  }
  return { ...pitchClass(step, alter), octave };
}
