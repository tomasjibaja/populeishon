import {
  type Duration,
  type Key,
  type Pitch,
  type TimeSignature,
  EIGHTH,
  HALF,
  QUARTER,
  SIXTEENTH,
  WHOLE,
  dottedDuration,
  duration,
  equalsDuration,
  keyTonic,
} from '@partituras/core';

/**
 * Conversión del modelo propio a los textos que espera VexFlow.
 * Funciones puras y sin importar VexFlow, para poder testearlas por separado.
 */

export interface VexDuration {
  /** Código de VexFlow: 'w', 'h', 'q', '8', '16', '32'. */
  readonly code: string;
  readonly dots: number;
}

const BASE_DURATIONS: ReadonlyArray<{ value: Duration; code: string }> = [
  { value: WHOLE, code: 'w' },
  { value: HALF, code: 'h' },
  { value: QUARTER, code: 'q' },
  { value: EIGHTH, code: '8' },
  { value: SIXTEENTH, code: '16' },
  { value: duration(1, 32), code: '32' },
];

/** Devuelve null si la duración no es una figura simple o con un puntillo (p. ej. tresillos). */
export function durationToVex(d: Duration): VexDuration | null {
  for (const { value, code } of BASE_DURATIONS) {
    if (equalsDuration(d, value)) return { code, dots: 0 };
    if (equalsDuration(d, dottedDuration(value))) return { code, dots: 1 };
  }
  return null;
}

/**
 * Texto de duración que espera VexFlow: código + una "d" por puntillo + "r" si es silencio
 * ("q", "qd", "qr", "qdr"). Los puntillos deben ir en el texto: de ahí salen los ticks
 * que VexFlow usa para comprobar que el compás está completo.
 */
export function vexDurationString(vex: VexDuration, isRest: boolean): string {
  return `${vex.code}${'d'.repeat(vex.dots)}${isRest ? 'r' : ''}`;
}

/** Anotación que VexFlow dibuja junto a la clave de sol ('8vb' para la clave de guitarra/tenor). */
export function clefAnnotation(octaveChange: number): '8va' | '8vb' | undefined {
  if (octaveChange === 1) return '8va';
  if (octaveChange === -1) return '8vb';
  return undefined;
}

/**
 * Cuántas octavas hay que sumar a la altura que suena para obtener la altura escrita en el pentagrama.
 * Con clave de sol 8vb (octaveChange = -1) las notas se escriben una octava más arriba de como suenan.
 */
export function clefOctaveShift(octaveChange: number): number {
  return -octaveChange;
}

const ALTER_TEXT: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' };

/** 'f#/4', 'bb/3'… La alteración que se dibuja la decide VexFlow según la armadura. */
export function pitchToVexKey(p: Pitch, octaveShift = 0): string {
  return `${p.step.toLowerCase()}${ALTER_TEXT[p.alter] ?? ''}/${p.octave + octaveShift}`;
}

/** Especificación de armadura de VexFlow: 'C', 'Bb', 'F#', 'Am', 'Ebm'… */
export function keySpec(k: Key): string {
  return `${keyTonic(k)}${k.mode === 'minor' ? 'm' : ''}`;
}

export function timeSpec(ts: TimeSignature): string {
  return `${ts.beats}/${ts.beatType}`;
}
