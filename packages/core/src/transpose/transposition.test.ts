import { describe, expect, it } from 'vitest';
import { key } from '../model/key';
import { pitch, pitchClass } from '../model/pitch';
import { LINE_MAX, LINE_MIN, lineOf, pitchClassAt, respellLine, semitonesOf } from './lineOfFifths';
import {
  regionTransposition,
  transposeKey,
  transposePitch,
  transposePitchClass,
  transpositionBetween,
} from './transposition';

describe('línea de quintas', () => {
  it('ubica las notas conocidas', () => {
    expect(lineOf(pitchClass('C'))).toBe(0);
    expect(lineOf(pitchClass('F', 1))).toBe(6);
    expect(lineOf(pitchClass('B', -1))).toBe(-2);
    expect(pitchClassAt(6)).toEqual({ step: 'F', alter: 1 });
    expect(pitchClassAt(-2)).toEqual({ step: 'B', alter: -1 });
    expect(pitchClassAt(-7)).toEqual({ step: 'C', alter: -1 });
  });

  it('es reversible en todo el rango de dobles alteraciones', () => {
    for (let line = LINE_MIN; line <= LINE_MAX; line++) {
      const p = pitchClassAt(line);
      expect(lineOf(p)).toBe(line);
      expect(Math.abs(p.alter) <= 2).toBe(true);
    }
  });

  it('usa la grafía enarmónica si se pasa de dobles alteraciones', () => {
    expect(respellLine(22)).toBe(10); // G### → A#
    expect(respellLine(-18)).toBe(-6); // Dbbb → Cb… (mismo sonido)
    expect(respellLine(5)).toBe(5);
    expect(semitonesOf(pitchClass('B', 1))).toBe(12);
    expect(semitonesOf(pitchClass('C', -1))).toBe(-1);
  });
});

describe('transpositionBetween', () => {
  it('calcula quintas y semitonos entre tonalidades', () => {
    expect(transpositionBetween(key(0), key(4))).toEqual({ fifths: 4, semitones: 4 });
    expect(transpositionBetween(key(0), key(-3))).toEqual({ fifths: -3, semitones: 3 }); // C → Eb: una tercera menor arriba
    expect(transpositionBetween(key(0), key(0))).toEqual({ fifths: 0, semitones: 0 });
    expect(transpositionBetween(key(1, 'minor'), key(0, 'minor'))).toEqual({ fifths: -1, semitones: 5 });
  });

  it('por defecto elige el intervalo más corto; se puede forzar arriba o abajo', () => {
    expect(transpositionBetween(key(0), key(1)).semitones).toBe(-5); // C → G: una cuarta abajo
    expect(transpositionBetween(key(0), key(1), { direction: 'up' }).semitones).toBe(7);
    expect(transpositionBetween(key(0), key(1), { direction: 'down' }).semitones).toBe(-5);
    expect(transpositionBetween(key(0), key(-1), { direction: 'down' }).semitones).toBe(-7);
    expect(transpositionBetween(key(0), key(6)).semitones).toBe(6); // tritono: se sube
    expect(transpositionBetween(key(0), key(-7)).semitones).toBe(-1); // C → Cb
  });

  it('permite sumar octavas', () => {
    expect(transpositionBetween(key(0), key(4), { octaves: -1 })).toEqual({ fifths: 4, semitones: -8 });
    expect(transpositionBetween(key(0), key(0), { octaves: 1 })).toEqual({ fifths: 0, semitones: 12 });
  });

  it('exige que las tonalidades sean del mismo modo', () => {
    expect(() => transpositionBetween(key(0), key(0, 'minor'))).toThrow();
  });
});

describe('transposePitch', () => {
  const up4 = { fifths: 4, semitones: 4 }; // C → E mayor

  it('transpone con el nombre correcto y la octava correcta', () => {
    expect(transposePitch(pitch('C', 4), up4)).toEqual(pitch('E', 4));
    expect(transposePitch(pitch('G', 4), up4)).toEqual(pitch('B', 4));
    expect(transposePitch(pitch('E', 4), up4)).toEqual(pitch('G', 4, 1));
    expect(transposePitch(pitch('B', 3), up4)).toEqual(pitch('D', 4, 1)); // cruza el límite de octava
    expect(transposePitch(pitch('F', 4, 1), { fifths: 2, semitones: 2 })).toEqual(pitch('G', 4, 1));
  });

  it('transpone hacia abajo y entre bemoles', () => {
    expect(transposePitch(pitch('G', 3), { fifths: -1, semitones: 5 })).toEqual(pitch('C', 4)); // C → F
    expect(transposePitch(pitch('B', 4), { fifths: -2, semitones: -2 })).toEqual(pitch('A', 4)); // C → Bb
    expect(transposePitch(pitch('E', 4), { fifths: -2, semitones: -2 })).toEqual(pitch('D', 4));
    expect(transposePitch(pitch('C', 4), { fifths: -7, semitones: -1 })).toEqual(pitch('C', 4, -1)); // C → Cb
  });

  it('usa la grafía enarmónica si haría falta una triple alteración', () => {
    expect(transposePitch(pitch('F', 4, 2), { fifths: 7, semitones: 1 })).toEqual(pitch('G', 4, 1));
  });

  it('rechaza transposiciones incoherentes y alturas fuera de rango', () => {
    expect(() => transposePitch(pitch('C', 4), { fifths: 1, semitones: 0 })).toThrow();
    expect(() => transposePitch(pitch('B', 9), up4)).toThrow();
  });

  it('transposePitchClass sigue la misma grafía sin octava', () => {
    expect(transposePitchClass(pitchClass('C'), up4)).toEqual(pitchClass('E'));
    expect(transposePitchClass(pitchClass('A'), up4)).toEqual(pitchClass('C', 1));
    expect(transposePitchClass(pitchClass('B', -1), { fifths: -2, semitones: -2 })).toEqual(pitchClass('A', -1));
  });
});

describe('transposeKey y regionTransposition', () => {
  it('gira la armadura y conserva el modo', () => {
    expect(transposeKey(key(0), { fifths: 4, semitones: 4 })).toEqual(key(4));
    expect(transposeKey(key(1, 'minor'), { fifths: -1, semitones: 5 })).toEqual(key(0, 'minor'));
    expect(transposeKey(key(-2), { fifths: 3, semitones: 9 })).toEqual(key(1));
  });

  it('si se saliera de 7 sostenidos o bemoles usa la tonalidad enarmónica', () => {
    // B mayor (5#) una tercera mayor arriba sería D# mayor (9#): se usa Eb mayor (3b)
    expect(transposeKey(key(5), { fifths: 4, semitones: 4 })).toEqual(key(-3));
    expect(transposeKey(key(-5), { fifths: -4, semitones: -4 })).toEqual(key(3));
  });

  it('las notas de una región enarmónica adoptan la grafía de su armadura', () => {
    expect(regionTransposition(key(5), { fifths: 4, semitones: 4 })).toEqual({ fifths: -8, semitones: 4 });
    expect(regionTransposition(key(0), { fifths: 4, semitones: 4 })).toEqual({ fifths: 4, semitones: 4 });
  });
});
