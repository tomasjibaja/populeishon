import { describe, expect, it } from 'vitest';
import {
  EIGHTH,
  HALF,
  QUARTER,
  addDuration,
  compareDuration,
  dottedDuration,
  duration,
  sumDurations,
} from './duration';

describe('duration', () => {
  it('normaliza fracciones', () => {
    expect(duration(2, 8)).toEqual({ num: 1, den: 4 });
    expect(duration(0, 5)).toEqual({ num: 0, den: 1 });
  });

  it('suma sin error de redondeo', () => {
    expect(addDuration(QUARTER, QUARTER)).toEqual(HALF);
    expect(addDuration(duration(3, 8), EIGHTH)).toEqual(HALF);
    expect(sumDurations([QUARTER, QUARTER, HALF])).toEqual({ num: 1, den: 1 });
  });

  it('calcula el puntillo', () => {
    expect(dottedDuration(QUARTER)).toEqual({ num: 3, den: 8 });
    expect(dottedDuration(HALF)).toEqual({ num: 3, den: 4 });
  });

  it('compara', () => {
    expect(compareDuration(QUARTER, HALF)).toBe(-1);
    expect(compareDuration(HALF, QUARTER)).toBe(1);
    expect(compareDuration(duration(2, 4), HALF)).toBe(0);
  });

  it('rechaza valores inválidos', () => {
    expect(() => duration(-1, 4)).toThrow();
    expect(() => duration(1, 0)).toThrow();
    expect(() => duration(1.5, 4)).toThrow();
  });
});
