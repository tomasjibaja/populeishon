import { describe, expect, it } from 'vitest';
import { formatKey } from '../format/format';
import { key } from './key';

describe('key', () => {
  it('nombra tonalidades mayores', () => {
    expect(formatKey(key(0))).toBe('C major');
    expect(formatKey(key(3))).toBe('A major');
    expect(formatKey(key(-2))).toBe('Bb major');
    expect(formatKey(key(6))).toBe('F# major');
    expect(formatKey(key(-7))).toBe('Cb major');
  });

  it('nombra tonalidades menores', () => {
    expect(formatKey(key(0, 'minor'))).toBe('A minor');
    expect(formatKey(key(-3, 'minor'))).toBe('C minor');
    expect(formatKey(key(4, 'minor'))).toBe('C# minor');
  });

  it('rechaza armaduras fuera de rango', () => {
    expect(() => key(8)).toThrow();
    expect(() => key(-8)).toThrow();
    expect(() => key(1.5)).toThrow();
  });
});
