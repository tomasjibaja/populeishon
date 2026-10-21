import { describe, expect, it } from 'vitest';
import { exampleScore } from '../fixtures/exampleScore';
import { longExampleScore } from '../fixtures/longExampleScore';
import { chordToText, parseChord, parseChordOrThrow } from '../chords/parseChord';
import { chord } from '../model/builders';
import { key } from '../model/key';
import { transposeChord } from './transposeChord';
import { transposeScore } from './transposeScore';
import { transpositionBetween } from './transposition';

const toE = transpositionBetween(key(0), key(4)); // C → E mayor
const toEb = transpositionBetween(key(0), key(-3)); // C → Eb mayor
const up = (symbol: string, t = toE) => transposeChord(chord(symbol), t).text;

describe('transposeChord', () => {
  it('C – Am – F – G en E mayor es E – C#m – A – B', () => {
    expect(['C', 'Am', 'F', 'G'].map((c) => up(c))).toEqual(['E', 'C#m', 'A', 'B']);
  });

  it('usa la grafía de la tonalidad destino (bemoles en Eb mayor)', () => {
    expect(['C', 'Am', 'F', 'G'].map((c) => up(c, toEb))).toEqual(['Eb', 'Cm', 'Ab', 'Bb']);
    expect(['Cm7', 'F7', 'Bbmaj7', 'Ebmaj7'].map((c) => up(c, toEb))).toEqual(['Ebm7', 'Ab7', 'Dbmaj7', 'Gbmaj7']);
  });

  it('transpone el bajo con el mismo intervalo (inversiones)', () => {
    expect(up('C/E')).toBe('E/G#');
    expect(up('G7/B')).toBe('B7/D#');
    expect(up('G7/B', toEb)).toBe('Bb7/D');
    expect(up('Am7/G')).toBe('C#m7/B');
    expect(up('F#m7/C#', transpositionBetween(key(0), key(-2)))).toBe('Em7/B');
  });

  it('conserva calidad y sufijo tal como los escribió el autor', () => {
    expect(up('C-7')).toBe('E-7');
    expect(up('CΔ7')).toBe('EΔ7');
    expect(up('Cø7')).toBe('Eø7');
    expect(up('C°7')).toBe('E°7');
    expect(up('C7b9')).toBe('E7b9');
    expect(up('C6/9')).toBe('E6/9');
    expect(up('Csus4')).toBe('Esus4');
    expect(up('Cm7b5')).toBe('Em7b5');
    const original = chord('C-7');
    const result = transposeChord(original, toE);
    expect(result.quality).toBe(original.quality);
    expect(result.suffix).toBe(original.suffix);
  });

  it('respeta el estilo ♯/♭ del cifrado original', () => {
    const step2 = { fifths: 2, semitones: 2 };
    expect(up('B♭7', step2)).toBe('C7');
    expect(up('F♯m', step2)).toBe('G♯m');
    expect(up('E♭maj7', step2)).toBe('Fmaj7');
    expect(up('C7♭9', step2)).toBe('D7♭9');
    expect(up('F#m', step2)).toBe('G#m');
  });

  it('no modifica el acorde original', () => {
    const original = Object.freeze(chord('G7/B'));
    transposeChord(original, toE);
    expect(original.text).toBe('G7/B');
    expect(original.root).toEqual({ step: 'G', alter: 0 });
  });

  it('chordToText admite glifos tipográficos', () => {
    const c = parseChordOrThrow('Bb7/D');
    expect(chordToText(c)).toBe('Bb7/D');
    expect(chordToText(c, { glyphs: true })).toBe('B♭7/D');
  });

  it('el texto regenerado se vuelve a leer con las mismas componentes', () => {
    const symbols = ['C', 'Am7', 'Fmaj7', 'G7', 'C/E', 'Dm7', 'G7b9', 'C#m7b5', 'Bb7', 'Ebm7/Bb', 'F-7', 'CΔ7', 'C6/9'];
    for (let fifths = -7; fifths <= 7; fifths++) {
      const t = transpositionBetween(key(0), key(fifths));
      for (const symbol of symbols) {
        const result = transposeChord(chord(symbol), t);
        const reparsed = parseChord(result.text);
        expect(reparsed.ok).toBe(true);
        if (reparsed.ok) {
          expect(reparsed.chord.root).toEqual(result.root);
          expect(reparsed.chord.bass).toEqual(result.bass);
          expect(reparsed.chord.suffix).toBe(result.suffix);
          expect(reparsed.chord.quality).toBe(result.quality);
        }
      }
    }
  });
});

describe('transposeScore con acordes', () => {
  const texts = (score: typeof exampleScore) => score.measures.flatMap((m) => m.chords.map((c) => c.chord.text));

  it('transpone los acordes junto con la melodía y la armadura', () => {
    expect(texts(exampleScore)).toEqual(['C', 'Am7', 'Fmaj7', 'G7', 'C/E', 'Am', 'Dm7', 'G7b9', 'Cmaj7']);
    const result = transposeScore(exampleScore, key(4));
    expect(texts(result)).toEqual(['E', 'C#m7', 'Amaj7', 'B7', 'E/G#', 'C#m', 'F#m7', 'B7b9', 'Emaj7']);
    expect(result.originalKey).toEqual(key(4));
  });

  it('en bemoles', () => {
    expect(texts(transposeScore(exampleScore, key(-3)))).toEqual(['Eb', 'Cm7', 'Abmaj7', 'Bb7', 'Eb/G', 'Cm', 'Fm7', 'Bb7b9', 'Ebmaj7']);
  });

  it('la posición de cada acorde en el compás no cambia', () => {
    const result = transposeScore(exampleScore, key(2));
    expect(result.measures[6]?.chords.map((c) => c.offset)).toEqual(exampleScore.measures[6]?.chords.map((c) => c.offset));
  });

  it('en una región con otra tonalidad, los acordes usan la grafía de su armadura (enarmonía)', () => {
    // C → C#: la región en G mayor (compás 17) pasaría a G# mayor (8 sostenidos): se usa Ab mayor
    const result = transposeScore(longExampleScore, key(7));
    const bar = (n: number) => result.measures.find((m) => m.number === n);
    expect(bar(1)?.chords[0]?.chord.text).toBe('C#');
    expect(bar(17)?.keySignature).toEqual(key(-4));
    expect(bar(17)?.chords[0]?.chord.text).toBe('Ab');
    expect(bar(18)?.chords[0]?.chord.text).toBe('Fm7'); // Em7 → E#m7 sería inusual: se escribe Fm7
  });

  it('ida y vuelta a todas las tonalidades devuelve los acordes originales', () => {
    for (let fifths = -7; fifths <= 7; fifths++) {
      const back = transposeScore(transposeScore(longExampleScore, key(fifths), { direction: 'up' }), key(0), { direction: 'down' });
      expect(back.measures.flatMap((m) => m.chords)).toEqual(longExampleScore.measures.flatMap((m) => m.chords));
    }
  });

  it('la progresión del enunciado: C – Am – F – G en E mayor es E – C#m – A – B', () => {
    const result = transposeScore(exampleScore, key(4));
    const simple = result.measures.slice(0, 4).map((m) => m.chords[0]?.chord.root);
    expect(simple).toEqual([
      { step: 'E', alter: 0 },
      { step: 'C', alter: 1 },
      { step: 'A', alter: 0 },
      { step: 'B', alter: 0 },
    ]);
  });
});
