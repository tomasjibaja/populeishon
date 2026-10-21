import { type Key, key } from '../model/key';
import { type Pitch, type PitchClass, pitch, pitchClass } from '../model/pitch';
import { lineOf, pitchClassAt, respellLine, semitonesOf } from './lineOfFifths';

/**
 * Una transposición se describe con dos números coherentes entre sí:
 * - `fifths`: cuánto se desplaza el NOMBRE de las notas en la cadena de quintas (define la grafía);
 * - `semitones`: cuánto se desplaza el SONIDO, con signo (define la octava). Cumple semitones ≡ 7·fifths (mod 12).
 */
export interface Transposition {
  readonly fifths: number;
  readonly semitones: number;
}

export type TransposeDirection = 'closest' | 'up' | 'down';

export interface TransposeOptions {
  /** 'closest' (por defecto) mueve el intervalo más corto; 'up' sube y 'down' baja. */
  readonly direction?: TransposeDirection;
  /** Octavas adicionales (+1 sube una octava más, -1 baja una). */
  readonly octaves?: number;
}

function assertConsistent(t: Transposition): void {
  if (!Number.isInteger(t.fifths) || !Number.isInteger(t.semitones) || (t.semitones - 7 * t.fifths) % 12 !== 0) {
    throw new RangeError(`Transposición incoherente (quintas ${t.fifths}, semitonos ${t.semitones}).`);
  }
}

/** Transposición que lleva una tonalidad a otra del mismo modo. */
export function transpositionBetween(from: Key, to: Key, options: TransposeOptions = {}): Transposition {
  if (from.mode !== to.mode) {
    throw new RangeError(`No se puede transponer de modo ${from.mode} a modo ${to.mode}: la tonalidad destino debe ser del mismo modo.`);
  }
  const fifths = to.fifths - from.fifths;
  const upward = (((7 * fifths) % 12) + 12) % 12; // 0..11 hacia arriba
  const direction = options.direction ?? 'closest';
  let semitones: number;
  if (direction === 'up') semitones = upward;
  else if (direction === 'down') semitones = upward === 0 ? 0 : upward - 12;
  else semitones = upward > 6 ? upward - 12 : upward;
  return { fifths, semitones: semitones + 12 * (options.octaves ?? 0) };
}

/** Transpone una altura: cambia su nombre por la línea de quintas y su octava por el desplazamiento real. */
export function transposePitch(p: Pitch, t: Transposition): Pitch {
  assertConsistent(t);
  const spelled = pitchClassAt(respellLine(lineOf(p) + t.fifths));
  const sounding = p.octave * 12 + semitonesOf(p) + t.semitones;
  const octave = (sounding - semitonesOf(spelled)) / 12;
  return pitch(spelled.step, octave, spelled.alter);
}

/** Transpone un nombre de nota sin octava (raíces y bajos de acordes). */
export function transposePitchClass(p: PitchClass, t: Transposition): PitchClass {
  assertConsistent(t);
  const spelled = pitchClassAt(respellLine(lineOf(p) + t.fifths));
  return pitchClass(spelled.step, spelled.alter);
}

/**
 * La transposición que efectivamente se aplica en una región de la partitura con esa tonalidad.
 * Si girar la armadura se saliera de los 7 bemoles o sostenidos (G# mayor), se usa la tonalidad
 * enarmónica (Ab mayor) y las notas de esa región adoptan la misma grafía.
 */
export function regionTransposition(region: Key, t: Transposition): Transposition {
  let fifths = region.fifths + t.fifths;
  if (fifths > 7) fifths -= 12;
  if (fifths < -7) fifths += 12;
  return { fifths: fifths - region.fifths, semitones: t.semitones };
}

/** Tonalidad resultante de transponer otra (conserva el modo). */
export function transposeKey(k: Key, t: Transposition): Key {
  assertConsistent(t);
  const applied = regionTransposition(k, t);
  return key(k.fifths + applied.fifths, k.mode);
}
