import { type Duration, duration } from './duration';

export interface TimeSignature {
  readonly beats: number;
  readonly beatType: number;
}

const VALID_BEAT_TYPES = [1, 2, 4, 8, 16, 32];

export function timeSignature(beats: number, beatType: number): TimeSignature {
  if (!Number.isInteger(beats) || beats < 1) {
    throw new RangeError(`Cantidad de tiempos inválida: ${beats}.`);
  }
  if (!VALID_BEAT_TYPES.includes(beatType)) {
    throw new RangeError(`Unidad de tiempo inválida: ${beatType}.`);
  }
  return { beats, beatType };
}

/** Duración total que debe tener un compás completo con este compás. */
export function measureCapacity(ts: TimeSignature): Duration {
  return duration(ts.beats, ts.beatType);
}
