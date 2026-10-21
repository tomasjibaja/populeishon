import type { Chord, ChordAt, ChordQuality } from '../model/chord';
import type { Clef } from '../model/clef';
import { type Duration, duration } from '../model/duration';
import { type Key, type Mode } from '../model/key';
import type { EndingStart, Measure } from '../model/measure';
import type { MeasureElement, Tie, TupletInfo } from '../model/note';
import { STEPS, type Pitch, type PitchClass, type Step } from '../model/pitch';
import { SCHEMA_VERSION, type Score, type ScoreSource, type Tempo } from '../model/score';
import type { TimeSignature } from '../model/timeSignature';

export type ParseScoreResult =
  | { readonly ok: true; readonly score: Score }
  | { readonly ok: false; readonly errors: string[] };

/** Límites que protegen a la base de datos y a la interfaz de datos desmesurados. */
export const SCORE_LIMITS = {
  title: 200,
  shortText: 200,
  id: 100,
  lyrics: 20000,
  measures: 5000,
  elementsPerMeasure: 512,
  chordsPerMeasure: 64,
  textsPerMeasure: 16,
  textLength: 100,
  chordText: 80,
  fileName: 255,
} as const;

const CHORD_QUALITIES: readonly ChordQuality[] = [
  'major', 'minor', 'dominant7', 'major7', 'minor7', 'diminished', 'diminished7', 'halfDiminished7', 'augmented',
  'sus2', 'sus4', 'dominant7sus4', 'major6', 'minor6', 'dominant9', 'major9', 'minor9', 'dominant11', 'dominant13',
  'minorMajor7', 'other',
];
const TIES: readonly Tie[] = ['start', 'stop', 'continue'];
const MODES: readonly Mode[] = ['major', 'minor'];
const SOURCE_KINDS: readonly ScoreSource['kind'][] = ['builtin', 'musicxml', 'manual'];
const MAX_ERRORS = 25;

interface Ctx {
  readonly errors: string[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function fail(ctx: Ctx, path: string, message: string): undefined {
  if (ctx.errors.length < MAX_ERRORS) ctx.errors.push(`${path}: ${message}`);
  return undefined;
}

function readString(ctx: Ctx, value: unknown, path: string, max: number, allowEmpty = false): string | undefined {
  if (typeof value !== 'string') return fail(ctx, path, 'debe ser un texto');
  if (!allowEmpty && value.trim() === '') return fail(ctx, path, 'no puede estar vacío');
  if (value.length > max) return fail(ctx, path, `es demasiado largo (máximo ${max} caracteres)`);
  return value;
}

function readOptionalString(ctx: Ctx, value: unknown, path: string, max: number): string | undefined {
  return value === undefined || value === null ? undefined : readString(ctx, value, path, max, true);
}

function readInt(ctx: Ctx, value: unknown, path: string, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value)) return fail(ctx, path, 'debe ser un número entero');
  if (value < min || value > max) return fail(ctx, path, `debe estar entre ${min} y ${max}`);
  return value;
}

function readBool(ctx: Ctx, value: unknown, path: string): boolean | undefined {
  return typeof value === 'boolean' ? value : fail(ctx, path, 'debe ser verdadero o falso');
}

function readOneOf<T extends string>(ctx: Ctx, value: unknown, path: string, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fail(ctx, path, `debe ser uno de: ${allowed.join(', ')}`);
}

function readArray(ctx: Ctx, value: unknown, path: string, max: number): unknown[] | undefined {
  if (!Array.isArray(value)) return fail(ctx, path, 'debe ser una lista');
  if (value.length > max) return fail(ctx, path, `tiene demasiados elementos (máximo ${max})`);
  return value;
}

function readObject(ctx: Ctx, value: unknown, path: string): Record<string, unknown> | undefined {
  return isObject(value) ? value : fail(ctx, path, 'debe ser un objeto');
}

function readDuration(ctx: Ctx, value: unknown, path: string): Duration | undefined {
  const o = readObject(ctx, value, path);
  if (!o) return undefined;
  const num = readInt(ctx, o.num, `${path}.num`, 0, 1_000_000);
  const den = readInt(ctx, o.den, `${path}.den`, 1, 1_000_000);
  return num === undefined || den === undefined ? undefined : duration(num, den);
}

function readPitchClass(ctx: Ctx, value: unknown, path: string): PitchClass | undefined {
  const o = readObject(ctx, value, path);
  if (!o) return undefined;
  const step = readOneOf<Step>(ctx, o.step, `${path}.step`, STEPS);
  const alter = readInt(ctx, o.alter, `${path}.alter`, -2, 2);
  return step === undefined || alter === undefined ? undefined : { step, alter };
}

function readPitch(ctx: Ctx, value: unknown, path: string): Pitch | undefined {
  const o = readObject(ctx, value, path);
  if (!o) return undefined;
  const pc = readPitchClass(ctx, o, path);
  const octave = readInt(ctx, o.octave, `${path}.octave`, -1, 9);
  return pc === undefined || octave === undefined ? undefined : { ...pc, octave };
}

function readKey(ctx: Ctx, value: unknown, path: string): Key | undefined {
  const o = readObject(ctx, value, path);
  if (!o) return undefined;
  const fifths = readInt(ctx, o.fifths, `${path}.fifths`, -7, 7);
  const mode = readOneOf<Mode>(ctx, o.mode, `${path}.mode`, MODES);
  return fifths === undefined || mode === undefined ? undefined : { fifths, mode };
}

function readTimeSignature(ctx: Ctx, value: unknown, path: string): TimeSignature | undefined {
  const o = readObject(ctx, value, path);
  if (!o) return undefined;
  const beats = readInt(ctx, o.beats, `${path}.beats`, 1, 64);
  const beatType = readInt(ctx, o.beatType, `${path}.beatType`, 1, 32);
  if (beats === undefined || beatType === undefined) return undefined;
  if (![1, 2, 4, 8, 16, 32].includes(beatType)) return fail(ctx, `${path}.beatType`, 'debe ser 1, 2, 4, 8, 16 o 32');
  return { beats, beatType };
}

function readTuplet(ctx: Ctx, value: unknown, path: string): TupletInfo | undefined {
  const o = readObject(ctx, value, path);
  if (!o) return undefined;
  const actual = readInt(ctx, o.actual, `${path}.actual`, 1, 64);
  const normal = readInt(ctx, o.normal, `${path}.normal`, 1, 64);
  if (actual === undefined || normal === undefined) return undefined;
  const start = o.start === undefined ? undefined : readBool(ctx, o.start, `${path}.start`);
  const stop = o.stop === undefined ? undefined : readBool(ctx, o.stop, `${path}.stop`);
  return { actual, normal, ...(start ? { start } : {}), ...(stop ? { stop } : {}) };
}

function readChord(ctx: Ctx, value: unknown, path: string): Chord | undefined {
  const o = readObject(ctx, value, path);
  if (!o) return undefined;
  const root = readPitchClass(ctx, o.root, `${path}.root`);
  const quality = readOneOf<ChordQuality>(ctx, o.quality, `${path}.quality`, CHORD_QUALITIES);
  const suffix = readString(ctx, o.suffix, `${path}.suffix`, 40, true);
  const text = readString(ctx, o.text, `${path}.text`, SCORE_LIMITS.chordText);
  const bass = o.bass === undefined ? undefined : readPitchClass(ctx, o.bass, `${path}.bass`);
  if (!root || !quality || suffix === undefined || text === undefined) return undefined;
  if (o.bass !== undefined && !bass) return undefined;
  return { root, quality, suffix, ...(bass ? { bass } : {}), text };
}

function readElement(ctx: Ctx, value: unknown, path: string): MeasureElement | undefined {
  const o = readObject(ctx, value, path);
  if (!o) return undefined;
  const type = readOneOf(ctx, o.type, `${path}.type`, ['note', 'rest'] as const);
  const dur = readDuration(ctx, o.duration, `${path}.duration`);
  const tuplet = o.tuplet === undefined ? undefined : readTuplet(ctx, o.tuplet, `${path}.tuplet`);
  if (!type || !dur || (o.tuplet !== undefined && !tuplet)) return undefined;

  if (type === 'rest') return { type, duration: dur, ...(tuplet ? { tuplet } : {}) };

  const pitch = readPitch(ctx, o.pitch, `${path}.pitch`);
  const tie = o.tie === undefined ? undefined : readOneOf<Tie>(ctx, o.tie, `${path}.tie`, TIES);
  if (!pitch || (o.tie !== undefined && !tie)) return undefined;
  return { type, pitch, duration: dur, ...(tie ? { tie } : {}), ...(tuplet ? { tuplet } : {}) };
}

function readMeasure(ctx: Ctx, value: unknown, path: string): Measure | undefined {
  const o = readObject(ctx, value, path);
  if (!o) return undefined;
  const before = ctx.errors.length;

  const number = readInt(ctx, o.number, `${path}.number`, 0, 100_000);
  const chordItems = readArray(ctx, o.chords, `${path}.chords`, SCORE_LIMITS.chordsPerMeasure) ?? [];
  const elementItems = readArray(ctx, o.elements, `${path}.elements`, SCORE_LIMITS.elementsPerMeasure) ?? [];

  const chords: ChordAt[] = [];
  chordItems.forEach((item, i) => {
    const p = `${path}.chords[${i}]`;
    const entry = readObject(ctx, item, p);
    if (!entry) return;
    const offset = readDuration(ctx, entry.offset, `${p}.offset`);
    const chord = readChord(ctx, entry.chord, `${p}.chord`);
    if (offset && chord) chords.push({ offset, chord });
  });

  const elements: MeasureElement[] = [];
  elementItems.forEach((item, i) => {
    const element = readElement(ctx, item, `${path}.elements[${i}]`);
    if (element) elements.push(element);
  });

  const flag = (name: 'pickup' | 'startRepeat' | 'endRepeat' | 'newSystem'): true | undefined =>
    o[name] === undefined ? undefined : readBool(ctx, o[name], `${path}.${name}`) ? true : undefined;
  const timeSignature = o.timeSignature === undefined ? undefined : readTimeSignature(ctx, o.timeSignature, `${path}.timeSignature`);
  const keySignature = o.keySignature === undefined ? undefined : readKey(ctx, o.keySignature, `${path}.keySignature`);
  const repeatTimes = o.repeatTimes === undefined ? undefined : readInt(ctx, o.repeatTimes, `${path}.repeatTimes`, 2, 99);
  const endBarline = o.endBarline === undefined ? undefined : readOneOf(ctx, o.endBarline, `${path}.endBarline`, ['double', 'final'] as const);
  const endingEnd = o.endingEnd === undefined ? undefined : readOneOf(ctx, o.endingEnd, `${path}.endingEnd`, ['closed', 'open'] as const);

  let endingStart: EndingStart | undefined;
  if (o.endingStart !== undefined) {
    const e = readObject(ctx, o.endingStart, `${path}.endingStart`);
    const numberItems = e ? readArray(ctx, e.numbers, `${path}.endingStart.numbers`, 8) : undefined;
    const label = e ? readString(ctx, e.label, `${path}.endingStart.label`, 40) : undefined;
    const numbers = (numberItems ?? []).map((n, i) => readInt(ctx, n, `${path}.endingStart.numbers[${i}]`, 1, 99));
    if (label !== undefined && numberItems && numbers.every((n): n is number => n !== undefined)) endingStart = { numbers, label };
  }

  let texts: string[] | undefined;
  if (o.texts !== undefined) {
    const items = readArray(ctx, o.texts, `${path}.texts`, SCORE_LIMITS.textsPerMeasure) ?? [];
    texts = items
      .map((t, i) => readString(ctx, t, `${path}.texts[${i}]`, SCORE_LIMITS.textLength))
      .filter((t): t is string => t !== undefined);
  }

  if (ctx.errors.length > before || number === undefined) return undefined;

  return {
    number,
    ...(flag('pickup') ? { pickup: true } : {}),
    ...(timeSignature ? { timeSignature } : {}),
    ...(keySignature ? { keySignature } : {}),
    ...(flag('startRepeat') ? { startRepeat: true } : {}),
    ...(flag('endRepeat') ? { endRepeat: true } : {}),
    ...(repeatTimes ? { repeatTimes } : {}),
    ...(flag('newSystem') ? { newSystem: true } : {}),
    ...(endBarline ? { endBarline } : {}),
    ...(endingStart ? { endingStart } : {}),
    ...(endingEnd ? { endingEnd } : {}),
    ...(texts && texts.length > 0 ? { texts } : {}),
    chords,
    elements,
  };
}

/**
 * Convierte datos de origen desconocido (por ejemplo, el cuerpo de una petición) en una `Score` válida.
 * Verifica tipos, rangos y tamaños, y construye objetos nuevos solo con los campos conocidos: lo que sobre se descarta
 * (así no llegan a la base de datos claves inesperadas, como las que empiezan con "$").
 * Chequea la estructura, no la coherencia musical (para eso está `validateScore`).
 * Las partituras transpuestas son vistas derivadas y no se aceptan. Los saltos de línea de la letra se normalizan a "\n".
 */
export function parseScore(input: unknown): ParseScoreResult {
  const ctx: Ctx = { errors: [] };
  const o = readObject(ctx, input, 'score');
  if (!o) return { ok: false, errors: ctx.errors };

  if (o.schemaVersion !== SCHEMA_VERSION) fail(ctx, 'score.schemaVersion', `debe ser ${SCHEMA_VERSION}`);
  if (o.transposition !== undefined) fail(ctx, 'score.transposition', 'las partituras transpuestas son vistas derivadas y no se guardan');

  const id = readString(ctx, o.id, 'score.id', SCORE_LIMITS.id);
  const title = readString(ctx, o.title, 'score.title', SCORE_LIMITS.title);
  const composer = readOptionalString(ctx, o.composer, 'score.composer', SCORE_LIMITS.shortText);
  const style = readOptionalString(ctx, o.style, 'score.style', SCORE_LIMITS.shortText);
  const rawLyrics = readOptionalString(ctx, o.lyrics, 'score.lyrics', SCORE_LIMITS.lyrics);
  const originalKey = readKey(ctx, o.originalKey, 'score.originalKey');
  const time = readTimeSignature(ctx, o.timeSignature, 'score.timeSignature');

  let tempo: Tempo | undefined;
  if (o.tempo !== undefined) {
    const t = readObject(ctx, o.tempo, 'score.tempo');
    const bpm = t ? readInt(ctx, t.bpm, 'score.tempo.bpm', 1, 1000) : undefined;
    const beatUnit = t ? readDuration(ctx, t.beatUnit, 'score.tempo.beatUnit') : undefined;
    if (bpm !== undefined && beatUnit) tempo = { bpm, beatUnit };
  }

  let clef: Clef | undefined;
  if (o.clef !== undefined) {
    const c = readObject(ctx, o.clef, 'score.clef');
    if (c) {
      const sign = readOneOf(ctx, c.sign, 'score.clef.sign', ['G'] as const);
      const octaveChange = readInt(ctx, c.octaveChange, 'score.clef.octaveChange', -2, 2);
      if (sign && octaveChange !== undefined) clef = { sign, octaveChange };
    }
  }

  let source: ScoreSource | undefined;
  const metadata = readObject(ctx, o.metadata, 'score.metadata');
  const rawSource = metadata ? readObject(ctx, metadata.source, 'score.metadata.source') : undefined;
  if (rawSource) {
    const kind = readOneOf(ctx, rawSource.kind, 'score.metadata.source.kind', SOURCE_KINDS);
    const fileName = readOptionalString(ctx, rawSource.fileName, 'score.metadata.source.fileName', SCORE_LIMITS.fileName);
    if (kind) source = { kind, ...(fileName ? { fileName } : {}) };
  }

  const measureItems = readArray(ctx, o.measures, 'score.measures', SCORE_LIMITS.measures);
  if (measureItems && measureItems.length === 0) fail(ctx, 'score.measures', 'debe tener al menos un compás');
  const measures: Measure[] = [];
  (measureItems ?? []).forEach((item, i) => {
    const measure = readMeasure(ctx, item, `score.measures[${i}]`);
    if (measure) measures.push(measure);
  });

  if (ctx.errors.length > 0 || !id || !title || !originalKey || !time || !source || !measureItems) {
    return { ok: false, errors: ctx.errors.length > 0 ? ctx.errors : ['score: datos incompletos'] };
  }

  const lyrics = rawLyrics?.replace(/\r\n?/g, '\n').replace(/\u0000/g, '');

  return {
    ok: true,
    score: {
      schemaVersion: SCHEMA_VERSION,
      id,
      title,
      ...(composer ? { composer } : {}),
      ...(style ? { style } : {}),
      ...(lyrics && lyrics.trim() !== '' ? { lyrics } : {}),
      originalKey,
      timeSignature: time,
      ...(tempo ? { tempo } : {}),
      ...(clef ? { clef } : {}),
      measures,
      metadata: { source },
    },
  };
}
