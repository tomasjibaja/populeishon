import { chordToText } from '../chords/parseChord';
import type { Chord } from '../model/chord';
import { type Transposition, transposePitchClass } from './transposition';

/**
 * Transpone un acorde por componentes: raíz y bajo con el mismo desplazamiento (misma grafía que la melodía:
 * C#m en E mayor, no Dbm), calidad y sufijo intactos, y el texto se regenera a partir de la estructura.
 * Si el cifrado original usaba ♯/♭, el nuevo también.
 */
export function transposeChord(chord: Chord, t: Transposition): Chord {
  const root = transposePitchClass(chord.root, t);
  const bass = chord.bass ? transposePitchClass(chord.bass, t) : undefined;
  const text = chordToText(
    { root, quality: chord.quality, suffix: chord.suffix, ...(bass ? { bass } : {}), text: '' },
    { glyphs: /[♯♭]/.test(chord.text) },
  );
  return { root, quality: chord.quality, suffix: chord.suffix, ...(bass ? { bass } : {}), text };
}
