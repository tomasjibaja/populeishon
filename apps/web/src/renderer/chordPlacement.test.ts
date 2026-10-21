import { describe, expect, it } from 'vitest';
import { QUARTER, duration } from '@partituras/core';
import { chordAnchorX } from './chordPlacement';

const starts = [duration(0, 1), duration(1, 4), duration(1, 2), duration(3, 4)];
const xs = [100, 150, 200, 250];
const total = duration(1, 1);

describe('chordAnchorX', () => {
  it('alinea el acorde con la nota que empieza en su posición', () => {
    expect(chordAnchorX(duration(0, 1), starts, xs, total, 300)).toBe(100);
    expect(chordAnchorX(duration(1, 2), starts, xs, total, 300)).toBe(200);
    expect(chordAnchorX(QUARTER, starts, xs, total, 300)).toBe(150);
  });

  it('interpola cuando el acorde cae a mitad de una nota', () => {
    expect(chordAnchorX(duration(1, 8), starts, xs, total, 300)).toBe(125);
    expect(chordAnchorX(duration(7, 8), starts, xs, total, 300)).toBe(275);
  });

  it('usa el final del compás si no hay notas', () => {
    expect(chordAnchorX(duration(0, 1), [], [], total, 300)).toBe(300);
  });
});
