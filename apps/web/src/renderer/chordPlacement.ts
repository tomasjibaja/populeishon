import { type Duration, ZERO_DURATION, compareDuration } from '@partituras/core';

const asNumber = (d: Duration): number => d.num / d.den;

/**
 * Posición horizontal de un acorde dentro de un compás ya formateado.
 * Si el acorde cae justo en una nota, se alinea con ella; si cae a mitad de una
 * figura larga, se interpola entre esa nota y la siguiente (o el final del compás).
 *
 * @param starts  inicio de cada nota/silencio dentro del compás
 * @param xs      posición x de cada nota/silencio (mismo orden que `starts`)
 * @param total   duración total de las notas del compás
 * @param endX    x del final útil del compás
 */
export function chordAnchorX(
  offset: Duration,
  starts: readonly Duration[],
  xs: readonly number[],
  total: Duration,
  endX: number,
): number {
  const first = xs[0];
  if (first === undefined) return endX;

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i] ?? ZERO_DURATION;
    const x = xs[i] ?? first;
    const nextStart = starts[i + 1] ?? total;
    const nextX = xs[i + 1] ?? endX;

    if (compareDuration(offset, start) === 0) return x;
    if (compareDuration(offset, start) > 0 && compareDuration(offset, nextStart) < 0) {
      const fraction = (asNumber(offset) - asNumber(start)) / (asNumber(nextStart) - asNumber(start));
      return x + fraction * (nextX - x);
    }
  }
  return endX;
}
