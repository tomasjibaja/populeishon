import { parseChordOrThrow } from '../chords/parseChord';
import type { Chord, ChordAt } from './chord';
import type { Duration } from './duration';
import type { Key } from './key';
import type { EndingStart, Measure } from './measure';
import type { MeasureElement, NoteElement, RestElement, Tie, TupletInfo } from './note';
import { type Step, pitch } from './pitch';
import type { TimeSignature } from './timeSignature';

/** Constructores cortos y validados. Sirven para fixtures, tests y, más adelante, el editor. */

export function note(
  step: Step,
  octave: number,
  dur: Duration,
  options: { alter?: number; tie?: Tie; tuplet?: TupletInfo } = {},
): NoteElement {
  return {
    type: 'note',
    pitch: pitch(step, octave, options.alter ?? 0),
    duration: dur,
    ...(options.tie ? { tie: options.tie } : {}),
    ...(options.tuplet ? { tuplet: options.tuplet } : {}),
  };
}

export function rest(dur: Duration, options: { tuplet?: TupletInfo } = {}): RestElement {
  return { type: 'rest', duration: dur, ...(options.tuplet ? { tuplet: options.tuplet } : {}) };
}

/** Crea un acorde a partir de su símbolo ("Dm7", "C/E"). Lanza si el símbolo no es válido. */
export function chord(text: string): Chord {
  return parseChordOrThrow(text);
}

export function chordAt(offset: Duration, c: Chord): ChordAt {
  return { offset, chord: c };
}

export interface MeasureOptions {
  chords?: readonly ChordAt[];
  timeSignature?: TimeSignature;
  keySignature?: Key;
  pickup?: boolean;
  startRepeat?: boolean;
  endRepeat?: boolean;
  repeatTimes?: number;
  newSystem?: boolean;
  endBarline?: 'double' | 'final';
  endingStart?: EndingStart;
  endingEnd?: 'closed' | 'open';
  texts?: readonly string[];
}

export function measure(number: number, elements: readonly MeasureElement[], options: MeasureOptions = {}): Measure {
  return {
    number,
    chords: options.chords ?? [],
    elements,
    ...(options.timeSignature ? { timeSignature: options.timeSignature } : {}),
    ...(options.keySignature ? { keySignature: options.keySignature } : {}),
    ...(options.pickup ? { pickup: true } : {}),
    ...(options.startRepeat ? { startRepeat: true } : {}),
    ...(options.endRepeat ? { endRepeat: true } : {}),
    ...(options.repeatTimes ? { repeatTimes: options.repeatTimes } : {}),
    ...(options.newSystem ? { newSystem: true } : {}),
    ...(options.endBarline ? { endBarline: options.endBarline } : {}),
    ...(options.endingStart ? { endingStart: options.endingStart } : {}),
    ...(options.endingEnd ? { endingEnd: options.endingEnd } : {}),
    ...(options.texts && options.texts.length > 0 ? { texts: options.texts } : {}),
  };
}
