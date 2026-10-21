import { describe, expect, it } from 'vitest';
import type { Chord, ChordQuality } from '../model/chord';
import { chordToText, parseChord, parseChordOrThrow } from './parseChord';

interface Expected {
  step: string;
  alter?: number;
  quality: ChordQuality;
  suffix: string;
  bass?: string;
  bassAlter?: number;
}

const VALID: ReadonlyArray<readonly [string, Expected]> = [
  ['C', { step: 'C', quality: 'major', suffix: '' }],
  ['Cm', { step: 'C', quality: 'minor', suffix: 'm' }],
  ['C7', { step: 'C', quality: 'dominant7', suffix: '7' }],
  ['CMaj7', { step: 'C', quality: 'major7', suffix: 'Maj7' }],
  ['Cmaj7', { step: 'C', quality: 'major7', suffix: 'maj7' }],
  ['Cm7', { step: 'C', quality: 'minor7', suffix: 'm7' }],
  ['Cdim', { step: 'C', quality: 'diminished', suffix: 'dim' }],
  ['Caug', { step: 'C', quality: 'augmented', suffix: 'aug' }],
  ['Csus4', { step: 'C', quality: 'sus4', suffix: 'sus4' }],
  ['C/E', { step: 'C', quality: 'major', suffix: '', bass: 'E' }],
  ['F#m7', { step: 'F', alter: 1, quality: 'minor7', suffix: 'm7' }],
  ['Bb7', { step: 'B', alter: -1, quality: 'dominant7', suffix: '7' }],
  ['Dbmaj7', { step: 'D', alter: -1, quality: 'major7', suffix: 'maj7' }],
  ['CΔ7', { step: 'C', quality: 'major7', suffix: 'Δ7' }],
  ['C^7', { step: 'C', quality: 'major7', suffix: '^7' }],
  ['C-7', { step: 'C', quality: 'minor7', suffix: '-7' }],
  ['Cø7', { step: 'C', quality: 'halfDiminished7', suffix: 'ø7' }],
  ['Cm7b5', { step: 'C', quality: 'halfDiminished7', suffix: 'm7b5' }],
  ['C°7', { step: 'C', quality: 'diminished7', suffix: '°7' }],
  ['Cdim7', { step: 'C', quality: 'diminished7', suffix: 'dim7' }],
  ['C+', { step: 'C', quality: 'augmented', suffix: '+' }],
  ['C6', { step: 'C', quality: 'major6', suffix: '6' }],
  ['Cm6', { step: 'C', quality: 'minor6', suffix: 'm6' }],
  ['C9', { step: 'C', quality: 'dominant9', suffix: '9' }],
  ['C13', { step: 'C', quality: 'dominant13', suffix: '13' }],
  ['C7b9', { step: 'C', quality: 'dominant7', suffix: '7b9' }],
  ['G7#11', { step: 'G', quality: 'dominant7', suffix: '7#11' }],
  ['D7alt', { step: 'D', quality: 'dominant7', suffix: '7alt' }],
  ['Cadd9', { step: 'C', quality: 'major', suffix: 'add9' }],
  ['C6/9', { step: 'C', quality: 'major6', suffix: '6/9' }],
  ['G7/B', { step: 'G', quality: 'dominant7', suffix: '7', bass: 'B' }],
  ['Ebm7/Bb', { step: 'E', alter: -1, quality: 'minor7', suffix: 'm7', bass: 'B', bassAlter: -1 }],
  ['C♯m7', { step: 'C', alter: 1, quality: 'minor7', suffix: 'm7' }],
  ['B♭', { step: 'B', alter: -1, quality: 'major', suffix: '' }],
  ['C##m', { step: 'C', alter: 2, quality: 'minor', suffix: 'm' }],
  ['CmMaj7', { step: 'C', quality: 'minorMajor7', suffix: 'mMaj7' }],
  ['Cm(maj7)', { step: 'C', quality: 'minorMajor7', suffix: 'm(maj7)' }],
  ['C7sus4', { step: 'C', quality: 'dominant7sus4', suffix: '7sus4' }],
  ['Csus', { step: 'C', quality: 'sus4', suffix: 'sus' }],
  ['Cmin7', { step: 'C', quality: 'minor7', suffix: 'min7' }],
  ['Comit3', { step: 'C', quality: 'major', suffix: 'omit3' }],
  ['Cxyz', { step: 'C', quality: 'other', suffix: 'xyz' }],
];

function parsed(input: string): Chord {
  const result = parseChord(input);
  if (!result.ok) throw new Error(`"${input}" debería ser válido: ${result.error}`);
  return result.chord;
}

describe('parseChord', () => {
  for (const [input, expected] of VALID) {
    it(`separa ${input}`, () => {
      const c = parsed(input);
      expect(c.root).toEqual({ step: expected.step, alter: expected.alter ?? 0 });
      expect(c.quality).toBe(expected.quality);
      expect(c.suffix).toBe(expected.suffix);
      expect(c.text).toBe(input);
      if (expected.bass) {
        expect(c.bass).toEqual({ step: expected.bass, alter: expected.bassAlter ?? 0 });
      } else {
        expect(c.bass).toBe(undefined);
      }
    });
  }

  for (const bad of ['', '   ', 'H7', 'c7', '7', 'C7$', 'C 7', 'C/', 'C/H', 'C7/']) {
    it(`rechaza "${bad}"`, () => {
      expect(parseChord(bad).ok).toBe(false);
    });
  }

  it('reconstruye el texto a partir de las componentes', () => {
    for (const input of ['C', 'Bb7', 'F#m7', 'C/E', 'Ebm7/Bb', 'C7b9', 'C6/9', 'Dbmaj7', 'C-7']) {
      expect(chordToText(parsed(input))).toBe(input);
    }
  });

  it('parseChordOrThrow lanza con símbolos inválidos', () => {
    expect(() => parseChordOrThrow('H7')).toThrow();
    expect(parseChordOrThrow('Am7').quality).toBe('minor7');
  });
});
