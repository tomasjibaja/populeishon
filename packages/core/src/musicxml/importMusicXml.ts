import { effectiveTimeSignatures } from '../analysis/analysis';
import { parseChord } from '../chords/parseChord';
import { formatChord, formatKey, formatTimeSignature } from '../format/format';
import type { ChordAt } from '../model/chord';
import type { Clef } from '../model/clef';
import {
  type Duration,
  EIGHTH,
  HALF,
  QUARTER,
  SIXTEENTH,
  WHOLE,
  ZERO_DURATION,
  compareDuration,
  dottedDuration,
  duration,
  sumDurations,
} from '../model/duration';
import { type Mode, key } from '../model/key';
import type { EndingStart, Measure } from '../model/measure';
import type { MeasureElement, NoteElement, Tie, TupletInfo } from '../model/note';
import { type Step, pitch } from '../model/pitch';
import { SCHEMA_VERSION, type Score, type Tempo } from '../model/score';
import { type TimeSignature, measureCapacity, timeSignature } from '../model/timeSignature';
import { validateScore } from '../validation/validateScore';
import { harmonyToText } from './harmony';
import { inferMode } from './inferMode';
import { type XmlElement, XmlParseError, child, childText, childrenNamed, find, parseXml } from './xml';

export interface ImportReportItem {
  readonly severity: 'info' | 'warning' | 'error';
  readonly message: string;
  /** Número de compás relacionado, si corresponde. */
  readonly measure?: number;
}

export interface ImportReport {
  readonly fileName?: string;
  readonly items: readonly ImportReportItem[];
}

export type ImportResult =
  | { readonly ok: true; readonly score: Score; readonly report: ImportReport }
  | { readonly ok: false; readonly report: ImportReport };

export interface ImportOptions {
  readonly fileName?: string;
  /** Identificador de la partitura resultante; por defecto, derivado del título. */
  readonly id?: string;
}

class ImportFailure extends Error {}

const PLACEHOLDERS = new Set(
  ['partitura sin título', 'compositor / arreglista', 'untitled score', 'composer / arranger'].map((s) => s.toLowerCase()),
);

const isPlaceholder = (text: string) => PLACEHOLDERS.has(text.trim().toLowerCase());
const cleanText = (text: string) => text.trim().replace(/\s*\n\s*/g, ' / ').replace(/[ \t]+/g, ' ');
const toInt = (text: string | undefined): number | undefined =>
  text !== undefined && /^-?\d+$/.test(text.trim()) ? Number(text.trim()) : undefined;
const slugify = (text: string) =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'partitura';

/** Texto de un <credit> del tipo pedido (title, subtitle, composer…). */
function creditText(root: XmlElement, type: string): string | undefined {
  for (const credit of childrenNamed(root, 'credit')) {
    if (!childrenNamed(credit, 'credit-type').some((t) => t.text === type)) continue;
    const text = cleanText(childrenNamed(credit, 'credit-words').map((w) => w.text).join(' '));
    if (text) return text;
  }
  return undefined;
}

interface RawMeasure {
  number: number;
  elements: MeasureElement[];
  chords: ChordAt[];
  timeSignature?: TimeSignature;
  keyChange?: { fifths: number; mode?: Mode };
  startRepeat?: boolean;
  endRepeat?: boolean;
  repeatTimes?: number;
  newSystem?: boolean;
  endBarline?: 'double' | 'final';
  endingStart?: EndingStart;
  endingEnd?: 'closed' | 'open';
  texts: string[];
}

/** Indicaciones de navegación que se conservan como texto del compás. */
const NAVIGATION_TEXT = /^(x\s?\d+|\d+\s?x|d\.?\s?[cs]\b.*|fine|to coda|al coda|al fine|coda|segno)$/i;
const JUMP_TEXT = /d\.?\s?[cs]\b|fine|coda|segno/i;
const JUMP_ATTRIBUTES: Readonly<Record<string, string>> = {
  dacapo: 'D.C.',
  dalsegno: 'D.S.',
  tocoda: 'To Coda',
  coda: 'Coda',
  segno: 'Segno',
  fine: 'Fine',
};

/** Grupo irregular de una nota (<time-modification> + marcas <tuplet> de inicio y fin). */
function readTuplet(note: XmlElement): TupletInfo | undefined {
  const modification = child(note, 'time-modification');
  if (!modification) return undefined;
  const actual = toInt(childText(modification, 'actual-notes'));
  const normal = toInt(childText(modification, 'normal-notes'));
  if (!actual || !normal || actual === normal) return undefined;
  const notations = child(note, 'notations');
  const marks = notations ? childrenNamed(notations, 'tuplet') : [];
  const start = marks.some((m) => m.attributes.type === 'start');
  const stop = marks.some((m) => m.attributes.type === 'stop');
  return { actual, normal, ...(start ? { start: true } : {}), ...(stop ? { stop: true } : {}) };
}

/** "x3" o "3x" → 3 (solo desde 2). */
function repeatCountOf(text: string): number | undefined {
  const match = /^x\s?(\d+)$|^(\d+)\s?x$/i.exec(text.trim());
  const count = match ? Number(match[1] ?? match[2]) : NaN;
  return Number.isInteger(count) && count >= 2 ? count : undefined;
}

function parseEndingNumbers(text: string | undefined): number[] {
  return (text ?? '')
    .split(/[,\s]+/)
    .map((part) => toInt(part))
    .filter((n): n is number => n !== undefined);
}

const BEAT_UNITS: Record<string, Duration> = {
  whole: WHOLE,
  half: HALF,
  quarter: QUARTER,
  eighth: EIGHTH,
  '16th': SIXTEENTH,
};

/**
 * Interpreta un MusicXML "score-partwise" (como exporta MuseScore) y lo convierte al modelo propio.
 * Nunca lanza: devuelve `ok: false` con un informe si el archivo no se puede interpretar.
 * Las decisiones (parte elegida, título, modo, qué se ignora) están en docs/importer-strategy.md.
 */
export function importMusicXml(source: string, options: ImportOptions = {}): ImportResult {
  const items: ImportReportItem[] = [];
  const add = (severity: ImportReportItem['severity'], message: string, measure?: number) => {
    items.push({ severity, message, ...(measure !== undefined ? { measure } : {}) });
  };
  const report = (): ImportReport => ({ ...(options.fileName ? { fileName: options.fileName } : {}), items });
  const failed = (message: string): ImportResult => {
    add('error', message);
    return { ok: false, report: report() };
  };

  const text = source.replace(/^\uFEFF/, '');
  if (text.startsWith('PK')) {
    return failed('Este archivo parece estar comprimido (.mxl). Exportalo desde MuseScore como "MusicXML sin comprimir" (.musicxml o .xml).');
  }

  let root: XmlElement;
  try {
    root = parseXml(text);
  } catch (error) {
    const detail = error instanceof XmlParseError ? error.message : String(error);
    return failed(`El archivo no es un XML válido: ${detail}`);
  }
  if (root.name === 'score-timewise') {
    return failed('El archivo está en formato "score-timewise", que todavía no se soporta. Exportalo como MusicXML estándar (score-partwise).');
  }
  if (root.name !== 'score-partwise') {
    return failed(`No parece un archivo MusicXML: el elemento principal es <${root.name}> y se esperaba <score-partwise>.`);
  }

  try {
    const score = buildScore(root, options, add);
    for (const issue of validateScore(score)) add('warning', `Revisión de la partitura: ${issue.message}`, issue.measure);
    return { ok: true, score, report: report() };
  } catch (error) {
    if (error instanceof ImportFailure) return failed(error.message);
    return failed(`Error inesperado al interpretar el archivo: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function buildScore(
  root: XmlElement,
  options: ImportOptions,
  add: (severity: ImportReportItem['severity'], message: string, measure?: number) => void,
): Score {
  // ---- metadatos ----
  const stem = options.fileName?.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim();
  const workTitle = find(root, 'work', 'work-title')?.text ?? '';
  const movementTitle = childText(root, 'movement-title') ?? '';
  // Prioridad: metadatos del archivo; si están vacíos o tienen el valor por defecto de MuseScore, los créditos.
  const metadataTitle = [workTitle, movementTitle].map(cleanText).find((t) => t && !isPlaceholder(t));
  const creditTitleRaw = creditText(root, 'title');
  const creditTitle = creditTitleRaw && !isPlaceholder(creditTitleRaw) ? creditTitleRaw : undefined;
  const title = metadataTitle ?? creditTitle ?? (stem || 'Sin título');
  if (!metadataTitle && !creditTitle && stem) {
    add('info', `El archivo no trae título; se usó el nombre del archivo: "${stem}".`);
  }
  const metadataComposer = childrenNamed(find(root, 'identification') ?? root, 'creator')
    .filter((c) => c.attributes.type === 'composer')
    .map((c) => cleanText(c.text))
    .find((t) => t && !isPlaceholder(t));
  const creditComposerRaw = creditText(root, 'composer');
  const creditComposer = creditComposerRaw && !isPlaceholder(creditComposerRaw) ? creditComposerRaw : undefined;
  const composer = metadataComposer ?? creditComposer;
  const style = creditText(root, 'subtitle');

  // ---- elegir la parte ----
  const parts = childrenNamed(root, 'part');
  if (parts.length === 0) throw new ImportFailure('El archivo no contiene ninguna parte musical (<part>).');
  const hasPitchedNotes = (part: XmlElement) =>
    childrenNamed(part, 'measure').some((m) => childrenNamed(m, 'note').some((n) => child(n, 'pitch')));
  const part = parts.find(hasPitchedNotes);
  if (!part) throw new ImportFailure('El archivo no contiene notas con altura definida.');
  const partName = (id: string | undefined) =>
    childrenNamed(find(root, 'part-list') ?? root, 'score-part').find((p) => p.attributes.id === id)
      ?.children.find((c) => c.name === 'part-name')?.text || id || '?';
  if (parts.length > 1) {
    const ignored = parts.filter((p) => p !== part).map((p) => `"${partName(p.attributes.id)}"`);
    add('warning', `El archivo tiene ${parts.length} partes. Se importó la primera con notas ("${partName(part.attributes.id)}") y se ignoraron: ${ignored.join(', ')}.`);
  }

  // ---- voz y pentagrama: el menor número que tenga notas ----
  const measureEls = childrenNamed(part, 'measure');
  const pitched = measureEls.flatMap((m) => childrenNamed(m, 'note')).filter((n) => child(n, 'pitch'));
  const staffOf = (n: XmlElement) => childText(n, 'staff') ?? '1';
  const voiceOf = (n: XmlElement) => childText(n, 'voice') ?? '1';
  const numeric = (a: string, b: string) => Number(a) - Number(b);
  const selectedStaff = [...new Set(pitched.map(staffOf))].sort(numeric)[0] ?? '1';
  const selectedVoice =
    [...new Set(pitched.filter((n) => staffOf(n) === selectedStaff).map(voiceOf))].sort(numeric)[0] ?? '1';

  // ---- recorrer compases ----
  const counts = {
    repeats: 0, endings: 0, grace: 0, chordNotes: 0, otherVoices: 0, unpitched: 0, tuplets: 0,
    degrees: 0, noChord: 0, dacapo: 0, tempoChanges: 0, clefChanges: 0, duplicateChords: 0,
  };
  const texts: string[] = [];
  let divisions: number | undefined;
  let firstKey: { fifths: number; mode?: Mode } | undefined;
  let currentFifths: number | undefined;
  let firstTime: TimeSignature | undefined;
  let currentTime: TimeSignature | undefined;
  let clef: Clef | undefined;
  let clefSeen = false;
  let soundTempo: number | undefined;
  let metronome: Tempo | undefined;
  const raw: RawMeasure[] = [];
  const allChords: ReturnType<typeof parseChord>[] = [];

  measureEls.forEach((measureEl, index) => {
    const parsedNumber = toInt(measureEl.attributes.number);
    const number = parsedNumber ?? index + 1;
    const rawMeasure: RawMeasure = { number, elements: [], chords: [], texts: [] };
    const jumpLabels: string[] = [];
    let position = 0;

    const toDuration = (divs: number): Duration => {
      if (divisions === undefined) throw new ImportFailure(`Compás ${number}: falta <divisions> antes de la primera nota.`);
      return duration(Math.max(0, divs), divisions * 4);
    };

    const readAttributes = (attr: XmlElement) => {
      const div = toInt(childText(attr, 'divisions'));
      if (div !== undefined) {
        if (div <= 0) throw new ImportFailure(`Compás ${number}: <divisions> inválido (${div}).`);
        divisions = div;
      }

      const keyEl = childrenNamed(attr, 'key').find((k) => !k.attributes.number || k.attributes.number === selectedStaff);
      if (keyEl) {
        const fifths = toInt(childText(keyEl, 'fifths'));
        if (fifths === undefined || fifths < -7 || fifths > 7) {
          add('warning', 'Armadura no estándar o sin <fifths>: se ignoró.', number);
        } else {
          const modeText = childText(keyEl, 'mode');
          let mode: Mode | undefined;
          if (modeText === 'major' || modeText === 'minor') mode = modeText;
          else if (modeText && modeText !== 'none') add('warning', `Modo "${modeText}" no soportado; se interpretará como mayor o menor.`, number);
          const entry = { fifths, ...(mode ? { mode } : {}) };
          if (index === 0 && firstKey === undefined) firstKey = entry;
          else if (fifths !== (currentFifths ?? 0)) rawMeasure.keyChange = entry;
          currentFifths = fifths;
        }
      }

      const timeEl = childrenNamed(attr, 'time').find((t) => !t.attributes.number || t.attributes.number === selectedStaff);
      if (timeEl) {
        const beats = toInt(childText(timeEl, 'beats'));
        const beatType = toInt(childText(timeEl, 'beat-type'));
        try {
          if (beats === undefined || beatType === undefined) throw new RangeError('compás no estándar');
          const ts = timeSignature(beats, beatType);
          if (currentTime === undefined) firstTime = currentTime = ts;
          else if (ts.beats !== currentTime.beats || ts.beatType !== currentTime.beatType) {
            rawMeasure.timeSignature = ts;
            currentTime = ts;
          }
        } catch {
          add('warning', `Indicación de compás no soportada ("${childText(timeEl, 'beats') ?? '?'}/${childText(timeEl, 'beat-type') ?? '?'}"): se ignoró.`, number);
        }
      }

      const clefEl = childrenNamed(attr, 'clef').find((c) => !c.attributes.number || c.attributes.number === selectedStaff);
      if (clefEl) {
        if (clefSeen) counts.clefChanges++;
        else {
          clefSeen = true;
          if (childText(clefEl, 'sign') === 'G' && childText(clefEl, 'line') === '2') {
            clef = { sign: 'G', octaveChange: toInt(childText(clefEl, 'clef-octave-change')) ?? 0 };
          } else {
            add('warning', `Clave "${childText(clefEl, 'sign') ?? '?'}" no soportada: se dibuja en clave de sol.`, number);
          }
        }
      }

      const staves = toInt(childText(attr, 'staves'));
      if (staves !== undefined && staves > 1 && index === 0) {
        add('warning', `La parte tiene ${staves} pentagramas; se importó solo el pentagrama ${selectedStaff}.`);
      }
    };

    const readSound = (sound: XmlElement) => {
      const tempo = Number(sound.attributes.tempo);
      if (sound.attributes.tempo !== undefined && Number.isFinite(tempo) && tempo > 0) {
        if (soundTempo === undefined) soundTempo = tempo;
        else counts.tempoChanges++;
      }
      for (const [attribute, label] of Object.entries(JUMP_ATTRIBUTES)) {
        if (sound.attributes[attribute] !== undefined) {
          counts.dacapo++;
          jumpLabels.push(label);
        }
      }
    };

    for (const el of measureEl.children) {
      switch (el.name) {
        case 'attributes':
          readAttributes(el);
          break;

        case 'sound':
          readSound(el);
          break;

        case 'direction': {
          for (const type of childrenNamed(el, 'direction-type')) {
            for (const words of childrenNamed(type, 'words')) {
              if (!words.text) continue;
              const text = cleanText(words.text);
              if (NAVIGATION_TEXT.test(text)) rawMeasure.texts.push(text);
              else texts.push(text);
            }
            const metro = child(type, 'metronome');
            const unit = metro ? BEAT_UNITS[childText(metro, 'beat-unit') ?? ''] : undefined;
            const perMinute = metro ? Number(childText(metro, 'per-minute')) : NaN;
            if (metro && unit && Number.isFinite(perMinute) && perMinute > 0 && metronome === undefined) {
              metronome = { bpm: perMinute, beatUnit: child(metro, 'beat-unit-dot') ? dottedDuration(unit) : unit };
            }
          }
          const sound = child(el, 'sound');
          if (sound) readSound(sound);
          break;
        }

        case 'barline': {
          const location = el.attributes.location ?? 'right';
          const barStyle = childText(el, 'bar-style');
          const repeat = child(el, 'repeat');
          if (repeat?.attributes.direction === 'forward') rawMeasure.startRepeat = true;
          else if (repeat?.attributes.direction === 'backward') {
            rawMeasure.endRepeat = true;
            const times = toInt(repeat.attributes.times);
            if (times !== undefined && times >= 2) rawMeasure.repeatTimes = times;
          }
          else if (location === 'right') {
            if (barStyle === 'light-light') rawMeasure.endBarline = 'double';
            else if (barStyle === 'light-heavy') rawMeasure.endBarline = 'final';
          }
          for (const ending of childrenNamed(el, 'ending')) {
            if (ending.attributes.type === 'start') {
              const numbers = parseEndingNumbers(ending.attributes.number);
              const label = cleanText(ending.text) || `${numbers.length > 0 ? numbers.join(', ') : '1'}.`;
              rawMeasure.endingStart = { numbers, label };
            } else if (ending.attributes.type === 'stop') rawMeasure.endingEnd = 'closed';
            else if (ending.attributes.type === 'discontinue') rawMeasure.endingEnd = 'open';
          }
          break;
        }

        case 'print':
          if (index > 0 && (el.attributes['new-system'] === 'yes' || el.attributes['new-page'] === 'yes')) {
            rawMeasure.newSystem = true;
          }
          break;

        case 'backup':
          position -= toInt(childText(el, 'duration')) ?? 0;
          break;

        case 'forward':
          position += toInt(childText(el, 'duration')) ?? 0;
          break;

        case 'harmony': {
          const result = harmonyToText(el);
          if (!result.ok) {
            if (result.reason.startsWith('sin acorde')) counts.noChord++;
            else add('warning', `Acorde ignorado: ${result.reason}.`, number);
            break;
          }
          const parsed = parseChord(result.text);
          if (!parsed.ok) {
            add('warning', `Acorde ignorado: ${parsed.error}`, number);
            break;
          }
          if (result.degreesIgnored) counts.degrees++;
          const extra = toInt(childText(el, 'offset')) ?? 0;
          const offset = toDuration(position + extra);
          if (rawMeasure.chords.some((c) => compareDuration(c.offset, offset) === 0)) counts.duplicateChords++;
          else rawMeasure.chords.push({ offset, chord: parsed.chord });
          allChords.push(parsed);
          break;
        }

        case 'note': {
          if (child(el, 'grace')) {
            counts.grace++;
            break;
          }
          const durDivs = toInt(childText(el, 'duration'));
          if (durDivs === undefined) break;
          const selected = voiceOf(el) === selectedVoice && staffOf(el) === selectedStaff;

          if (child(el, 'chord')) {
            if (selected) counts.chordNotes++;
            break; // las notas simultáneas no avanzan el tiempo
          }
          if (!selected) {
            counts.otherVoices++;
            position += durDivs;
            break;
          }
          if (child(el, 'unpitched')) {
            counts.unpitched++;
            position += durDivs;
            break;
          }
          const tuplet = readTuplet(el);
          if (tuplet) counts.tuplets++;

          const dur = toDuration(durDivs);
          if (child(el, 'rest')) {
            rawMeasure.elements.push({ type: 'rest', duration: dur, ...(tuplet ? { tuplet } : {}) });
          } else {
            const pitchEl = child(el, 'pitch');
            const step = pitchEl ? childText(pitchEl, 'step') : undefined;
            const octave = toInt(pitchEl ? childText(pitchEl, 'octave') : undefined);
            const alterText = pitchEl ? childText(pitchEl, 'alter') : undefined;
            const alter = alterText === undefined ? 0 : Number(alterText);
            if (!step || !/^[A-G]$/.test(step) || octave === undefined || octave < -1 || octave > 9 || !Number.isInteger(alter) || alter < -2 || alter > 2) {
              add('warning', `Nota ignorada: altura no soportada (${step ?? '?'}${alterText ?? ''}${octave ?? '?'}).`, number);
              position += durDivs;
              break;
            }
            const ties = new Set(childrenNamed(el, 'tie').map((t) => t.attributes.type));
            const tie: Tie | undefined =
              ties.has('start') && ties.has('stop') ? 'continue' : ties.has('start') ? 'start' : ties.has('stop') ? 'stop' : undefined;
            const noteEl: NoteElement = {
              type: 'note',
              pitch: pitch(step as Step, octave, alter),
              duration: dur,
              ...(tie ? { tie } : {}),
              ...(tuplet ? { tuplet } : {}),
            };
            rawMeasure.elements.push(noteEl);
          }
          position += durDivs;
          break;
        }

        default:
          break;
      }
    }

    for (const label of jumpLabels) {
      if (!rawMeasure.texts.some((t) => JUMP_TEXT.test(t))) rawMeasure.texts.push(label);
    }
    rawMeasure.chords.sort((a, b) => compareDuration(a.offset, b.offset));
    raw.push(rawMeasure);
  });

  // "x3" se escribe al comienzo de la sección pero pertenece a la barra de fin de repetición que la cierra.
  raw.forEach((r, i) => {
    const kept: string[] = [];
    for (const text of r.texts) {
      const times = repeatCountOf(text);
      const target = times === undefined ? undefined : raw.slice(i).find((candidate) => candidate.endRepeat);
      if (times !== undefined && target) {
        if (target.repeatTimes === undefined) target.repeatTimes = times;
      } else {
        kept.push(text);
      }
    }
    r.texts = kept;
  });

  if (raw.length === 0 || raw.every((m) => m.elements.length === 0)) {
    throw new ImportFailure('La parte elegida no tiene compases con notas.');
  }

  // ---- tonalidad, modo y compás iniciales ----
  if (firstKey === undefined) add('warning', 'El archivo no indica la armadura; se asumió sin alteraciones (C mayor).');
  const fifths = firstKey?.fifths ?? 0;
  const chordList = allChords.flatMap((c) => (c.ok ? [c.chord] : []));
  let mode: Mode;
  if (firstKey?.mode) {
    mode = firstKey.mode;
  } else {
    const inference = inferMode(fifths, chordList);
    mode = inference.mode;
    const name = formatKey(key(fifths, mode));
    if (inference.decidedBy === 'default') {
      add('warning', `El archivo no indica si la tonalidad es mayor o menor y los acordes no permiten deducirlo: se asumió ${name}. Revisalo, porque afecta a la transposición.`);
    } else {
      const chord = inference.decidedBy === 'last-chord' ? chordList[chordList.length - 1] : chordList[0];
      add('info', `El archivo no indica el modo de la tonalidad. Se interpretó como ${name} según el ${inference.decidedBy === 'last-chord' ? 'último' : 'primer'} acorde (${chord ? formatChord(chord) : '?'}).`);
    }
  }
  if (firstTime === undefined) add('warning', 'El archivo no indica el compás; se asumió 4/4.');
  const initialTime = firstTime ?? timeSignature(4, 4);

  // ---- compases definitivos ----
  let activeTime = initialTime;
  let nextNumber = 1;
  const measures: Measure[] = raw.map((r, index) => {
    if (r.timeSignature) activeTime = r.timeSignature;
    const total = sumDurations(r.elements.map((e) => e.duration));
    const capacity = measureCapacity(activeTime);
    const pickup = index === 0 && compareDuration(total, ZERO_DURATION) > 0 && compareDuration(total, capacity) < 0;
    // Numeración propia: la anacrusa es el compás 0 y el primer compás completo es el 1.
    return {
      number: pickup ? 0 : nextNumber++,
      ...(pickup ? { pickup: true } : {}),
      ...(r.newSystem ? { newSystem: true } : {}),
      ...(r.timeSignature ? { timeSignature: r.timeSignature } : {}),
      ...(r.keyChange ? { keySignature: key(r.keyChange.fifths, r.keyChange.mode ?? mode) } : {}),
      ...(r.startRepeat ? { startRepeat: true } : {}),
      ...(r.endRepeat ? { endRepeat: true } : {}),
      ...(r.repeatTimes ? { repeatTimes: r.repeatTimes } : {}),
      ...(r.endBarline ? { endBarline: r.endBarline } : {}),
      ...(r.endingStart ? { endingStart: r.endingStart } : {}),
      ...(r.endingEnd ? { endingEnd: r.endingEnd } : {}),
      ...(r.texts.length > 0 ? { texts: [...new Set(r.texts)] } : {}),
      chords: r.chords,
      elements: r.elements,
    };
  });

  // ---- tempo ----
  const tempo: Tempo | undefined =
    metronome ?? (soundTempo !== undefined ? { bpm: soundTempo, beatUnit: QUARTER } : undefined);

  // ---- resumen del informe ----
  const chordCount = measures.reduce((n, m) => n + m.chords.length, 0);
  const score: Score = {
    schemaVersion: SCHEMA_VERSION,
    id: options.id ?? slugify(title),
    title,
    ...(composer ? { composer } : {}),
    ...(style ? { style } : {}),
    originalKey: key(fifths, mode),
    timeSignature: initialTime,
    ...(tempo ? { tempo } : {}),
    ...(clef ? { clef } : {}),
    measures,
    metadata: { source: { kind: 'musicxml', ...(options.fileName ? { fileName: options.fileName } : {}) } },
  };
  // El resumen va primero en el informe.
  const summary = `Parte "${partName(part.attributes.id)}": ${measures.length} compases, ${formatKey(score.originalKey)}, ${formatTimeSignature(initialTime)}, ${chordCount} acordes.`;
  add('info', summary);

  const startRepeats = measures.filter((m) => m.startRepeat).length;
  const endRepeats = measures.filter((m) => m.endRepeat).length;
  const endings = measures.filter((m) => m.endingStart).length;
  const doubleBars = measures.filter((m) => m.endBarline === 'double').length;
  const structure = [
    startRepeats + endRepeats > 0 ? `${startRepeats} inicio(s) y ${endRepeats} fin(es) de repetición` : '',
    endings > 0 ? `${endings} casilla(s)` : '',
    doubleBars > 0 ? `${doubleBars} doble(s) barra(s)` : '',
  ].filter(Boolean);
  if (structure.length > 0) add('info', `Estructura importada: ${structure.join(', ')}.`);
  if (counts.dacapo > 0) {
    add('info', 'Las indicaciones de D.C./D.S./coda/segno se muestran como texto sobre el compás; todavía no se interpretan como saltos.');
  }
  if (counts.tuplets > 0) add('info', `Se importaron ${counts.tuplets} nota(s) de tresillo o de otro grupo irregular, con su duración exacta.`);
  if (counts.otherVoices > 0) add('warning', `Se ignoraron ${counts.otherVoices} nota(s) de otras voces o pentagramas: solo se importa una melodía (voz ${selectedVoice}, pentagrama ${selectedStaff}).`);
  if (counts.chordNotes > 0) add('warning', `Se ignoraron ${counts.chordNotes} nota(s) simultánea(s): solo se importa la melodía (la primera nota escrita de cada grupo).`);
  if (counts.unpitched > 0) add('warning', `Se ignoraron ${counts.unpitched} nota(s) sin altura (percusión).`);
  if (counts.clefChanges > 0) add('warning', `Se ignoraron ${counts.clefChanges} cambio(s) de clave.`);
  if (counts.duplicateChords > 0) add('warning', `Se ignoraron ${counts.duplicateChords} acorde(s) repetido(s) en la misma posición.`);
  if (counts.degrees > 0) add('info', `${counts.degrees} acorde(s) tenían alteraciones adicionales (<degree>) que se ignoraron; se conserva el símbolo base.`);
  if (counts.noChord > 0) add('info', `Se ignoraron ${counts.noChord} marca(s) de "sin acorde" (N.C.).`);
  if (counts.grace > 0) add('info', `Se ignoraron ${counts.grace} nota(s) de adorno.`);
  if (counts.tempoChanges > 0) add('info', `Se ignoraron ${counts.tempoChanges} cambio(s) de tempo; se usa el inicial.`);
  if (texts.length > 0) add('info', `Textos de dirección ignorados: ${[...new Set(texts)].join(', ')}.`);
  if (clef && clef.octaveChange !== 0) {
    add('info', `La clave de sol lleva cambio de octava (${clef.octaveChange > 0 ? '+' : ''}${clef.octaveChange}): las notas se interpretan como suenan y se dibujan en su posición escrita.`);
  }

  return score;
}
