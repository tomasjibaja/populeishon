import type { Chord } from '../model/chord';
import type { Duration } from '../model/duration';
import { type Key, keyTonic } from '../model/key';
import type { Measure } from '../model/measure';
import { type MeasureElement, notatedDuration } from '../model/note';
import type { Pitch, PitchClass } from '../model/pitch';
import type { TimeSignature } from '../model/timeSignature';

/** Texto legible de los objetos del modelo (para UI de diagnóstico y mensajes). */

const ALTER_SYMBOL: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' };

export function formatPitchClass(p: PitchClass): string {
  return `${p.step}${ALTER_SYMBOL[p.alter] ?? ''}`;
}

export function formatPitch(p: Pitch): string {
  return `${formatPitchClass(p)}${p.octave}`;
}

export function formatDuration(d: Duration): string {
  return `${d.num}/${d.den}`;
}

const DURATION_NAMES: Record<string, string> = {
  '1/1': 'redonda',
  '1/2': 'blanca',
  '3/4': 'blanca con puntillo',
  '1/4': 'negra',
  '3/8': 'negra con puntillo',
  '1/8': 'corchea',
  '3/16': 'corchea con puntillo',
  '1/16': 'semicorchea',
};

/** Nombre de figura si es una de las usuales; si no, la fracción. */
export function describeDuration(d: Duration): string {
  return DURATION_NAMES[formatDuration(d)] ?? formatDuration(d);
}

export function formatKey(k: Key): string {
  return `${keyTonic(k)} ${k.mode}`;
}

/** Armadura en palabras: "sin alteraciones", "4♯", "2♭". */
export function formatKeySignature(k: Key): string {
  if (k.fifths === 0) return 'sin alteraciones';
  return `${Math.abs(k.fifths)}${k.fifths > 0 ? '♯' : '♭'}`;
}

export function formatTimeSignature(ts: TimeSignature): string {
  return `${ts.beats}/${ts.beatType}`;
}

export function formatChord(c: Chord): string {
  return c.text;
}

/** Tiempo (empezando en 1) correspondiente a una posición dentro del compás. */
export function formatBeat(offset: Duration, ts: TimeSignature): string {
  const beat = 1 + (offset.num / offset.den) * ts.beatType;
  return Number.isInteger(beat) ? String(beat) : beat.toFixed(2).replace(/0+$/, '');
}

const TIE_TEXT = {
  start: ' ligada al siguiente',
  stop: ' ligada al anterior',
  continue: ' ligada a ambos lados',
} as const;

function tupletText(el: MeasureElement): string {
  if (!el.tuplet) return '';
  return el.tuplet.actual === 3 && el.tuplet.normal === 2
    ? ' (tresillo)'
    : ` (grupo ${el.tuplet.actual}:${el.tuplet.normal})`;
}

export function formatElement(el: MeasureElement): string {
  const figure = describeDuration(notatedDuration(el));
  if (el.type === 'rest') return `silencio de ${figure}${tupletText(el)}`;
  return `${formatPitch(el.pitch)} ${figure}${tupletText(el)}${el.tie ? TIE_TEXT[el.tie] : ''}`;
}

const DISPLAY_ALTER: Record<number, string> = { [-2]: '♭♭', [-1]: '♭', 0: '', 1: '♯', 2: '♯♯' };

function displayNote(p: PitchClass): string {
  return `${p.step}${DISPLAY_ALTER[p.alter] ?? ''}`;
}

/** Cifrado tipográfico para dibujar: C♯m7♭5, B♭/D, G7♭9… */
export function formatChordSymbol(c: Chord): string {
  const suffix = c.suffix.replace(/b(?=\d)/g, '♭').replace(/#/g, '♯');
  return `${displayNote(c.root)}${suffix}${c.bass ? `/${displayNote(c.bass)}` : ''}`;
}

/** Resumen legible de las marcas de estructura de un compás (repeticiones, casillas, barras, textos). */
export function formatStructure(m: Measure): string[] {
  const parts: string[] = [];
  if (m.startRepeat) parts.push('inicio de repetición');
  if (m.endingStart) parts.push(`empieza casilla ${m.endingStart.label}`);
  if (m.endRepeat) parts.push(m.repeatTimes ? `fin de repetición (x${m.repeatTimes})` : 'fin de repetición');
  if (m.endingEnd) parts.push(m.endingEnd === 'closed' ? 'cierra casilla' : 'fin de casilla (abierta)');
  if (m.endBarline === 'double') parts.push('doble barra');
  if (m.endBarline === 'final') parts.push('barra final');
  if (m.newSystem) parts.push('salto de línea');
  for (const text of m.texts ?? []) parts.push(`texto "${text}"`);
  return parts;
}
