import { effectiveKeys } from '../analysis/analysis';
import { formatPitch } from '../format/format';
import type { Key } from '../model/key';
import type { Measure } from '../model/measure';
import type { MeasureElement } from '../model/note';
import type { Score } from '../model/score';
import { transposeChord } from './transposeChord';
import {
  type TransposeOptions,
  type Transposition,
  regionTransposition,
  transposeKey,
  transposePitch,
  transpositionBetween,
} from './transposition';

/**
 * Devuelve la partitura escrita en `target`, sin modificar la original.
 *
 * Cambian: las alturas de las notas (nombre y octava), los acordes y sus bajos, la armadura inicial y las
 * armaduras de los cambios de tonalidad. `originalKey` de la Score devuelta es la tonalidad destino y `transposition` registra el origen.
 *
 * Los acordes se transponen por componentes (raíz y bajo; la calidad y el sufijo no cambian) con la misma
 * grafía que la melodía, y su texto se regenera.
 *
 *
 * La tonalidad destino debe ser del mismo modo que la original. Si una nota quedara fuera del rango de octavas
 * soportado, lanza un RangeError con el número de compás.
 */
export function transposeScore(score: Score, target: Key, options: TransposeOptions = {}): Score {
  const base = transpositionBetween(score.originalKey, target, options);
  const regions = effectiveKeys(score);

  const measures: Measure[] = score.measures.map((m, index) => {
    const region = regions[index] ?? score.originalKey;
    const applied = regionTransposition(region, base);
    return {
      ...m,
      ...(m.keySignature ? { keySignature: transposeKey(m.keySignature, base) } : {}),
      chords: m.chords.map(({ offset, chord }) => ({ offset, chord: transposeChord(chord, applied) })),
      elements: m.elements.map((el) => transposeElement(el, applied, m.number)),
    };
  });

  const previous = score.transposition;
  const composed: Transposition = {
    fifths: (previous?.fifths ?? 0) + base.fifths,
    semitones: (previous?.semitones ?? 0) + base.semitones,
  };

  return {
    ...score,
    originalKey: target,
    transposition: { from: previous?.from ?? score.originalKey, ...composed },
    measures,
  };
}

function transposeElement(el: MeasureElement, t: Transposition, measureNumber: number): MeasureElement {
  if (el.type === 'rest') return el;
  try {
    return { ...el, pitch: transposePitch(el.pitch, t) };
  } catch (error) {
    if (error instanceof RangeError) {
      throw new RangeError(
        `Compás ${measureNumber}: la nota ${formatPitch(el.pitch)} queda fuera del rango de octavas al transponer. Probá con otra octava.`,
      );
    }
    throw error;
  }
}
