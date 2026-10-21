import { describe, expect, it } from 'vitest';
import { type TieElement, pairTies } from './ties';

const note = (pitchKey: string, tie?: 'start' | 'stop' | 'continue'): TieElement => ({
  isNote: true,
  pitchKey,
  ...(tie ? { tie } : {}),
});
const rest: TieElement = { isNote: false };

describe('pairTies', () => {
  it('une una nota con la siguiente de igual altura', () => {
    const r = pairTies([note('g/4', 'start'), note('g/4', 'stop'), note('a/4')]);
    expect(r.pairs).toEqual([{ from: 0, to: 1 }]);
    expect(r.unmatched).toEqual([]);
  });

  it('encadena ligaduras con "continue"', () => {
    const r = pairTies([note('c/5', 'start'), note('c/5', 'continue'), note('c/5', 'stop')]);
    expect(r.pairs).toEqual([
      { from: 0, to: 1 },
      { from: 1, to: 2 },
    ]);
  });

  it('un silencio o una altura distinta rompen la ligadura', () => {
    expect(pairTies([note('g/4', 'start'), rest, note('g/4', 'stop')]).unmatched).toEqual([0, 2]);
    expect(pairTies([note('g/4', 'start'), note('a/4', 'stop')]).unmatched).toEqual([0, 1]);
  });

  it('detecta aperturas y cierres huérfanos', () => {
    expect(pairTies([note('g/4', 'start')]).unmatched).toEqual([0]);
    expect(pairTies([note('g/4', 'stop')]).unmatched).toEqual([0]);
    expect(pairTies([note('g/4'), note('g/4')]).pairs).toEqual([]);
  });
});
