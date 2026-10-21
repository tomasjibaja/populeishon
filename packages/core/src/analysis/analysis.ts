import { type Duration, sumDurations } from '../model/duration';
import type { Key } from '../model/key';
import type { Measure } from '../model/measure';
import type { Score } from '../model/score';
import type { TimeSignature } from '../model/timeSignature';

export function measureDuration(m: Measure): Duration {
  return sumDurations(m.elements.map((e) => e.duration));
}

export function scoreDuration(score: Score): Duration {
  return sumDurations(score.measures.map(measureDuration));
}

/** Compás vigente en cada compás, resolviendo los cambios intermedios. */
export function effectiveTimeSignatures(score: Score): TimeSignature[] {
  let current = score.timeSignature;
  return score.measures.map((m) => {
    if (m.timeSignature) current = m.timeSignature;
    return current;
  });
}

/** Tonalidad vigente en cada compás, resolviendo los cambios intermedios. */
export function effectiveKeys(score: Score): Key[] {
  let current = score.originalKey;
  return score.measures.map((m) => {
    if (m.keySignature) current = m.keySignature;
    return current;
  });
}
