/**
 * Duración como fracción exacta de redonda: 1/1 = redonda, 1/4 = negra.
 * Se usan fracciones (y no strings tipo "q") para poder representar
 * puntillos, tresillos y validar la suma de un compás sin errores de redondeo.
 * Las representaciones de cada renderer (p. ej. VexFlow) se derivan después.
 */
export interface Duration {
  readonly num: number;
  readonly den: number;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Crea una duración normalizada (2/8 → 1/4). */
export function duration(num: number, den: number): Duration {
  if (!Number.isInteger(num) || !Number.isInteger(den)) {
    throw new RangeError(`La duración debe usar enteros (recibido ${num}/${den}).`);
  }
  if (num < 0) throw new RangeError(`La duración no puede ser negativa (${num}/${den}).`);
  if (den <= 0) throw new RangeError(`El denominador debe ser positivo (${num}/${den}).`);
  const g = gcd(num, den);
  return { num: num / g, den: den / g };
}

export const ZERO_DURATION: Duration = duration(0, 1);
export const WHOLE: Duration = duration(1, 1);
export const HALF: Duration = duration(1, 2);
export const QUARTER: Duration = duration(1, 4);
export const EIGHTH: Duration = duration(1, 8);
export const SIXTEENTH: Duration = duration(1, 16);

export function addDuration(a: Duration, b: Duration): Duration {
  return duration(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function sumDurations(list: readonly Duration[]): Duration {
  return list.reduce(addDuration, ZERO_DURATION);
}

/** Devuelve -1, 0 o 1. */
export function compareDuration(a: Duration, b: Duration): -1 | 0 | 1 {
  const diff = a.num * b.den - b.num * a.den;
  return diff < 0 ? -1 : diff > 0 ? 1 : 0;
}

export function equalsDuration(a: Duration, b: Duration): boolean {
  return compareDuration(a, b) === 0;
}

/** Añade un puntillo: la duración pasa a valer 3/2 de la original. */
export function dottedDuration(d: Duration): Duration {
  return duration(d.num * 3, d.den * 2);
}
