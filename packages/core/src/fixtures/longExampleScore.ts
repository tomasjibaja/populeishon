import {
  type ChordAt,
  type Measure,
  type MeasureOptions,
  type MeasureElement,
  type Score,
  EIGHTH,
  HALF,
  QUARTER,
  SCHEMA_VERSION,
  WHOLE,
  ZERO_DURATION,
  chord,
  chordAt,
  dottedDuration,
  duration,
  key,
  measure,
  note,
  rest,
  timeSignature,
} from '../model';

const q = (s: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B', o: number, alter = 0, tie?: 'start' | 'stop') =>
  note(s, o, QUARTER, { alter, ...(tie ? { tie } : {}) });
const e = (s: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B', o: number, alter = 0) => note(s, o, EIGHTH, { alter });
const h = (s: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B', o: number, tie?: 'start' | 'stop') =>
  note(s, o, HALF, tie ? { tie } : {});
const dottedQuarter = (s: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B', o: number, alter = 0) =>
  note(s, o, dottedDuration(QUARTER), { alter });
/** Corchea de tresillo (3:2): dura 1/12. */
const triplet = (s: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B', o: number, position: 'start' | 'middle' | 'stop') =>
  note(s, o, duration(1, 12), {
    tuplet: { actual: 3, normal: 2, ...(position === 'start' ? { start: true } : {}), ...(position === 'stop' ? { stop: true } : {}) },
  });
const dottedHalf = (s: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B', o: number) =>
  note(s, o, dottedDuration(HALF));

/** Acordes de un compás: uno en el tiempo 1, o dos (tiempo 1 y tiempo 3). */
const one = (symbol: string): ChordAt[] => [chordAt(ZERO_DURATION, chord(symbol))];
const two = (a: string, b: string): ChordAt[] => [chordAt(ZERO_DURATION, chord(a)), chordAt(HALF, chord(b))];

const bar = (n: number, elements: MeasureElement[], chords: ChordAt[], options: MeasureOptions = {}): Measure =>
  measure(n, elements, { chords, ...options });

/**
 * Partitura de 33 compases para probar el layout: anacrusa, corcheas con barras, puntillos,
 * silencios, ligaduras (dentro del compás y entre compases), alteraciones accidentales,
 * cambio de tonalidad (C → G → C) y cambio de compás (4/4 → 3/4 → 4/4).
 * También repeticiones (compases 9 a 15), casillas 1.ª y 2.ª, dobles barras, "x2" sobre la barra de fin de repetición, "D.C." y barra final.
 * Un tresillo de corcheas (compás 14) y un compás de silencio completo en 3/4 (compás 27).
 * El último compás completa la anacrusa. Material original de ejemplo.
 */
export const longExampleScore: Score = {
  schemaVersion: SCHEMA_VERSION,
  id: 'ejemplo-largo-etapa-4',
  title: 'Melodía de ejemplo larga',
  composer: 'Ejemplo integrado',
  style: 'Ejemplo',
  originalKey: key(0, 'major'),
  timeSignature: timeSignature(4, 4),
  tempo: { bpm: 110, beatUnit: QUARTER },
  measures: [
    bar(0, [q('G', 4)], [], { pickup: true }),
    bar(1, [q('C', 5), q('B', 4), q('A', 4), q('G', 4)], one('C')),
    bar(2, [e('A', 4), e('B', 4), e('C', 5), e('D', 5), h('E', 5)], one('Am7')),
    bar(3, [q('D', 5), q('C', 5), q('B', 4), q('G', 4)], two('Dm7', 'G7')),
    bar(4, [h('C', 5, 'start'), q('C', 5, 0, 'stop'), rest(QUARTER)], one('Cmaj7')),
    bar(5, [q('F', 4), q('A', 4), q('C', 5), q('A', 4)], one('Fmaj7')),
    bar(6, [dottedQuarter('D', 4), e('F', 4, 1), h('A', 4)], one('D7')),
    bar(7, [h('G', 4), q('B', 4), q('D', 5)], one('G7')),
    bar(8, [note('C', 5, WHOLE)], one('C6'), { endBarline: 'double' }),
    bar(9, [q('E', 4), q('G', 4), q('A', 4), q('C', 5)], one('Am7'), { startRepeat: true }),
    bar(10, [e('D', 5), e('C', 5), e('B', 4), e('A', 4), h('G', 4)], one('D7')),
    bar(11, [q('B', 4), q('A', 4), q('G', 4), q('F', 4)], one('G7')),
    bar(12, [q('E', 4), q('F', 4), h('G', 4, 'start')], one('Cmaj7')),
    bar(13, [q('G', 4, 0, 'stop'), q('A', 4), h('B', 4)], one('Em7')),
    bar(14, [q('A', 4), q('G', 4), triplet('F', 4, 'start'), triplet('E', 4, 'middle'), triplet('D', 4, 'stop'), q('E', 4)], one('Fmaj7')),
    bar(15, [q('D', 4), q('F', 4), q('A', 4), q('B', 4)], two('Dm7', 'G7'), {
      endingStart: { numbers: [1], label: '1.' },
      endRepeat: true,
      repeatTimes: 2,
      endingEnd: 'closed',
    }),
    bar(16, [note('C', 5, WHOLE)], one('C'), {
      endingStart: { numbers: [2], label: '2.' },
      endingEnd: 'open',
      endBarline: 'double',
    }),
    // Cambio de tonalidad a G mayor
    bar(17, [q('B', 4), q('D', 5), q('G', 5), q('D', 5)], one('G'), { keySignature: key(1, 'major') }),
    bar(18, [e('E', 5), e('F', 5, 1), e('G', 5), e('A', 5), h('B', 5)], one('Em7')),
    bar(19, [q('A', 4), q('B', 4), q('C', 5), q('D', 5)], two('Am7', 'D7')),
    bar(20, [q('G', 4), q('F', 4), q('E', 4), q('D', 4)], one('G7')),
    bar(21, [h('E', 5), q('D', 5), q('C', 5)], one('Cmaj7')),
    bar(22, [q('A', 4), q('C', 5), q('E', 5), q('C', 5)], one('Am7')),
    bar(23, [q('F', 4, 1), q('A', 4), h('D', 5)], one('D7')),
    bar(24, [note('G', 4, WHOLE)], one('Gmaj7')),
    // Cambio de compás a 3/4
    bar(25, [q('E', 4), q('G', 4), q('B', 4)], one('Em7'), { timeSignature: timeSignature(3, 4) }),
    bar(26, [q('C', 5), q('B', 4), q('A', 4)], one('Am7')),
    bar(27, [rest(dottedDuration(HALF))], one('D7')),
    bar(28, [dottedHalf('B', 4)], one('Gmaj7')),
    // Vuelta a 4/4 y a C mayor
    bar(29, [q('F', 4), q('A', 4), q('D', 5), q('A', 4)], one('Dm7'), {
      timeSignature: timeSignature(4, 4),
      keySignature: key(0, 'major'),
    }),
    bar(30, [e('B', 4), e('A', 4), e('G', 4), e('F', 4), h('D', 4)], one('G7')),
    bar(31, [q('D', 5), q('B', 4), q('G', 4), q('D', 4)], two('Dm7', 'G7')),
    bar(32, [dottedHalf('C', 5)], one('Cmaj7'), { endBarline: 'final', texts: ['D.C.'] }),
  ],
  metadata: { source: { kind: 'builtin' } },
};
