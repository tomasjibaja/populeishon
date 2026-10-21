import { describe, expect, it } from 'vitest';
import { exampleScore } from '../fixtures/exampleScore';
import { longExampleScore } from '../fixtures/longExampleScore';
import { measure, note } from '../model/builders';
import { WHOLE } from '../model/duration';
import { key } from '../model/key';
import type { Score } from '../model/score';
import { transposeScore } from './transposeScore';

const noteAt = (score: Score, measureNumber: number, index: number) => {
  const found = score.measures.find((m) => m.number === measureNumber)?.elements[index];
  if (!found || found.type !== 'note') throw new Error(`No hay nota ${index} en el compás ${measureNumber}`);
  return found.pitch;
};

/** Congela en profundidad: si el código intentara modificar la original, lanzaría un error. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
  }
  return value;
}

describe('transposeScore', () => {
  it('transpone melodía y armadura, y registra el origen (C mayor → E mayor)', () => {
    const result = transposeScore(exampleScore, key(4));
    expect(result.originalKey).toEqual(key(4));
    expect(result.transposition).toEqual({ from: key(0), fifths: 4, semitones: 4 });
    expect(noteAt(result, 1, 0)).toEqual({ step: 'G', alter: 1, octave: 4 }); // E4 → G#4
    expect(noteAt(result, 1, 1)).toEqual({ step: 'B', alter: 0, octave: 4 }); // G4 → B4
    expect(noteAt(result, 1, 2)).toEqual({ step: 'E', alter: 0, octave: 5 }); // C5 → E5
  });

  it('no modifica la original', () => {
    const frozen = deepFreeze(JSON.parse(JSON.stringify(longExampleScore)) as Score);
    const snapshot = JSON.stringify(frozen);
    transposeScore(frozen, key(-3));
    transposeScore(frozen, key(7), { direction: 'down' });
    expect(JSON.stringify(frozen)).toBe(snapshot);
    expect(frozen.originalKey).toEqual(key(0));
    expect(frozen.transposition).toBe(undefined);
  });

  it('transpone hacia bemoles con el intervalo más corto (C → Bb mayor)', () => {
    const result = transposeScore(exampleScore, key(-2));
    expect(result.transposition).toEqual({ from: key(0), fifths: -2, semitones: -2 });
    expect(noteAt(result, 1, 0)).toEqual({ step: 'D', alter: 0, octave: 4 }); // E4 → D4
  });

  it('respeta dirección y octavas', () => {
    expect(noteAt(transposeScore(exampleScore, key(1)), 1, 0)).toEqual({ step: 'B', alter: 0, octave: 3 });
    expect(noteAt(transposeScore(exampleScore, key(1), { direction: 'up' }), 1, 0)).toEqual({ step: 'B', alter: 0, octave: 4 });
    expect(noteAt(transposeScore(exampleScore, key(4), { octaves: -1 }), 1, 0)).toEqual({ step: 'G', alter: 1, octave: 3 });
  });

  it('a la misma tonalidad devuelve una copia equivalente', () => {
    const result = transposeScore(exampleScore, key(0));
    expect(result).toEqual({ ...exampleScore, transposition: { from: key(0), fifths: 0, semitones: 0 } });
    expect(result === exampleScore).toBe(false);
    expect(result.measures === exampleScore.measures).toBe(false);
  });

  it('rechaza una tonalidad de otro modo', () => {
    expect(() => transposeScore(exampleScore, key(0, 'minor'))).toThrow();
  });

  it('transpone también los cambios de tonalidad dentro de la partitura', () => {
    const result = transposeScore(longExampleScore, key(4)); // C → E
    expect(result.measures.find((m) => m.number === 17)?.keySignature).toEqual(key(5)); // G → B
    expect(result.measures.find((m) => m.number === 29)?.keySignature).toEqual(key(4)); // C → E
    // compás 17 está en G mayor: B4 → D#5 (con la armadura de B mayor)
    expect(noteAt(result, 17, 0)).toEqual({ step: 'D', alter: 1, octave: 5 });
    // F natural accidental en G mayor (compás 20) → A natural
    expect(noteAt(result, 20, 1)).toEqual({ step: 'A', alter: 0, octave: 4 });
  });

  it('conserva todo lo demás: duración, ligaduras, tresillos, posición y calidad de los acordes, y estructura', () => {
    const result = transposeScore(longExampleScore, key(-3));
    result.measures.forEach((m, i) => {
      const original = longExampleScore.measures[i]!;
      expect(m.chords.map((c) => c.offset)).toEqual(original.chords.map((c) => c.offset));
      expect(m.chords.map((c) => c.chord.quality)).toEqual(original.chords.map((c) => c.chord.quality));
      expect(m.chords.map((c) => c.chord.suffix)).toEqual(original.chords.map((c) => c.chord.suffix));
      expect(m.number).toBe(original.number);
      expect(m.pickup).toBe(original.pickup);
      expect(m.endRepeat).toBe(original.endRepeat);
      expect(m.endingStart).toEqual(original.endingStart);
      expect(m.elements.map((e) => e.duration)).toEqual(original.elements.map((e) => e.duration));
      expect(m.elements.map((e) => e.tuplet)).toEqual(original.elements.map((e) => e.tuplet));
      expect(m.elements.map((e) => (e.type === 'note' ? e.tie : undefined))).toEqual(
        original.elements.map((e) => (e.type === 'note' ? e.tie : undefined)),
      );
      expect(m.elements.map((e) => e.type)).toEqual(original.elements.map((e) => e.type));
    });
    expect(result.title).toBe(longExampleScore.title);
    expect(result.tempo).toEqual(longExampleScore.tempo);
  });

  it('ida y vuelta a cualquier tonalidad mayor devuelve exactamente la partitura original', () => {
    for (let fifths = -7; fifths <= 7; fifths++) {
      const there = transposeScore(longExampleScore, key(fifths), { direction: 'up' });
      const back = transposeScore(there, key(0), { direction: 'down' });
      expect(back.originalKey).toEqual(key(0));
      expect(back.measures).toEqual(longExampleScore.measures);
      expect(back.transposition).toEqual({ from: key(0), fifths: 0, semitones: 0 });
    }
  });

  it('ida y vuelta en modo menor', () => {
    const minor: Score = { ...exampleScore, originalKey: key(-3, 'minor') };
    for (let fifths = -7; fifths <= 7; fifths++) {
      const back = transposeScore(transposeScore(minor, key(fifths, 'minor'), { direction: 'up' }), key(-3, 'minor'), {
        direction: 'down',
      });
      expect(back.measures).toEqual(minor.measures);
    }
  });

  it('todas las alturas resultantes caben en el rango y cada nota suena el desplazamiento pedido', () => {
    const chroma = (p: { step: string; alter: number; octave: number }) =>
      p.octave * 12 + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[p.step]! + p.alter;
    for (let fifths = -7; fifths <= 7; fifths++) {
      const result = transposeScore(longExampleScore, key(fifths));
      const shift = result.transposition!.semitones;
      result.measures.forEach((m, i) => {
        m.elements.forEach((e, k) => {
          const original = longExampleScore.measures[i]!.elements[k]!;
          if (e.type === 'note' && original.type === 'note') {
            expect(chroma(e.pitch) - chroma(original.pitch)).toBe(shift);
          }
        });
      });
    }
  });

  it('transponer dos veces compone el desplazamiento y recuerda el origen', () => {
    const twice = transposeScore(transposeScore(exampleScore, key(4)), key(1));
    expect(twice.originalKey).toEqual(key(1));
    expect(twice.transposition).toEqual({ from: key(0), fifths: 1, semitones: 7 });
  });

  it('avisa con el número de compás si una nota se sale del rango de octavas', () => {
    const high: Score = { ...exampleScore, measures: [measure(1, [note('B', 9, WHOLE)])] };
    expect(() => transposeScore(high, key(4))).toThrow();
    try {
      transposeScore(high, key(4));
    } catch (error) {
      expect((error as Error).message.includes('Compás 1')).toBe(true);
    }
  });
});
