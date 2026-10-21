import {
  type Score,
  HALF,
  QUARTER,
  SCHEMA_VERSION,
  WHOLE,
  ZERO_DURATION,
  chord,
  chordAt,
  key,
  measure,
  note,
  timeSignature,
} from '../model';

/** Partitura hardcodeada de 8 compases en C mayor, 4/4. Material original de ejemplo. */
export const exampleScore: Score = {
  schemaVersion: SCHEMA_VERSION,
  id: 'ejemplo-etapa-1',
  title: 'Melodía de ejemplo',
  composer: 'Ejemplo integrado',
  style: 'Ejemplo',
  originalKey: key(0, 'major'),
  timeSignature: timeSignature(4, 4),
  tempo: { bpm: 100, beatUnit: QUARTER },
  measures: [
    measure(1, [note('E', 4, QUARTER), note('G', 4, QUARTER), note('C', 5, HALF)], {
      chords: [chordAt(ZERO_DURATION, chord('C'))],
    }),
    measure(2, [note('A', 4, QUARTER), note('G', 4, QUARTER), note('E', 4, QUARTER), note('C', 4, QUARTER)], {
      chords: [chordAt(ZERO_DURATION, chord('Am7'))],
    }),
    measure(3, [note('F', 4, QUARTER), note('A', 4, QUARTER), note('C', 5, QUARTER), note('A', 4, QUARTER)], {
      chords: [chordAt(ZERO_DURATION, chord('Fmaj7'))],
    }),
    measure(4, [note('G', 4, HALF), note('B', 4, QUARTER), note('D', 5, QUARTER)], {
      chords: [chordAt(ZERO_DURATION, chord('G7'))],
    }),
    measure(5, [note('E', 4, QUARTER), note('G', 4, QUARTER), note('C', 5, HALF)], {
      chords: [chordAt(ZERO_DURATION, chord('C/E'))],
    }),
    measure(6, [note('A', 4, QUARTER), note('C', 5, QUARTER), note('E', 5, HALF)], {
      chords: [chordAt(ZERO_DURATION, chord('Am'))],
    }),
    measure(7, [note('A', 4, QUARTER), note('C', 5, QUARTER), note('B', 4, QUARTER), note('D', 5, QUARTER)], {
      chords: [chordAt(ZERO_DURATION, chord('Dm7')), chordAt(HALF, chord('G7b9'))],
    }),
    measure(8, [note('C', 5, WHOLE)], {
      chords: [chordAt(ZERO_DURATION, chord('Cmaj7'))],
    }),
  ],
  metadata: { source: { kind: 'builtin' } },
};
