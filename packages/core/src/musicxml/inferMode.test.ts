import { describe, expect, it } from 'vitest';
import { parseChordOrThrow } from '../chords/parseChord';
import { inferMode } from './inferMode';

const chords = (...symbols: string[]) => symbols.map(parseChordOrThrow);

describe('inferMode', () => {
  it('deduce menor si el último acorde es la tónica menor de la armadura', () => {
    expect(inferMode(1, chords('G', 'D7', 'Em'))).toEqual({ mode: 'minor', decidedBy: 'last-chord' });
    expect(inferMode(0, chords('C', 'E7', 'Am'))).toEqual({ mode: 'minor', decidedBy: 'last-chord' });
    expect(inferMode(-3, chords('Cm7'))).toEqual({ mode: 'minor', decidedBy: 'last-chord' });
  });

  it('deduce mayor si el último acorde es la tónica mayor', () => {
    expect(inferMode(1, chords('Em', 'D7', 'G'))).toEqual({ mode: 'major', decidedBy: 'last-chord' });
    expect(inferMode(0, chords('Am', 'G7', 'Cmaj7'))).toEqual({ mode: 'major', decidedBy: 'last-chord' });
  });

  it('si el final no decide, mira el primer acorde', () => {
    expect(inferMode(1, chords('Em', 'B7', 'C'))).toEqual({ mode: 'minor', decidedBy: 'first-chord' });
  });

  it('un acorde con la raíz de la tónica pero calidad contraria no decide', () => {
    expect(inferMode(0, chords('Am7', 'C')).mode).toBe('major');
    expect(inferMode(0, chords('Cm')).decidedBy).toBe('default');
  });

  it('sin acordes o sin pistas asume mayor y lo indica', () => {
    expect(inferMode(2, [])).toEqual({ mode: 'major', decidedBy: 'default' });
    expect(inferMode(2, chords('A', 'E7')).decidedBy).toBe('default');
  });
});
